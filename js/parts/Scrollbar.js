(function (H) {
	var addEvent = H.addEvent,
		Axis = H.Axis,
		Chart = H.Chart,
		correctFloat = H.correctFloat,
		defaultOptions = H.defaultOptions,
		defined = H.defined,
		destroyObjectProperties = H.destroyObjectProperties,
		doc = H.doc,
		each = H.each,
		fireEvent = H.fireEvent,
		hasTouch = H.hasTouch,
		isTouchDevice = H.isTouchDevice,
		merge = H.merge,
		pick = H.pick,
		removeEvent = H.removeEvent,
		svg = H.svg,
		wrap = H.wrap;

var defaultScrollbarOptions =  {
	//enabled: true
	height: isTouchDevice ? 20 : 14,
	// trackBorderRadius: 0
	barBorderRadius: 0,
	buttonBorderRadius: 0,
	liveRedraw: svg && !isTouchDevice,
	margin: 10, // docs
	minWidth: 6,
	//showFull: true, // docs
	//size: null,	// docs
	step: 0.2,		// docs
	zIndex: 3,		// docs
	/*= if (build.classic) { =*/
	barBackgroundColor: '#bfc8d1',
	barBorderWidth: 1,
	barBorderColor: '#bfc8d1',
	buttonArrowColor: '#666',
	buttonBackgroundColor: '#ebe7e8',
	buttonBorderColor: '#bbb',
	buttonBorderWidth: 1,
	rifleColor: '#666',
	trackBackgroundColor: '#eeeeee',
	trackBorderColor: '#eeeeee',
	trackBorderWidth: 1
	/*= } =*/
};

defaultOptions.scrollbar = merge(true, defaultScrollbarOptions, defaultOptions.scrollbar);

/**
 * The Scrollbar class 
 * @param {Object} renderer
 * @param {Object} options
 * @param {Object} chart
 */
function Scrollbar(renderer, options, chart) { // docs
	this.init(renderer, options, chart);
}

Scrollbar.prototype = {

	init: function (renderer, options, chart) {

		this.scrollbarButtons = [];

		this.renderer = renderer;

		this.userOptions = options;
		this.options = merge(defaultScrollbarOptions, options);

		this.chart = chart;

		this.size = pick(this.options.size, this.options.height); // backward compatibility

		// Init
		if (options.enabled) {
			this.render();
			this.initEvents();
			this.addEvents();
		}
	},

	/**
	* Render scrollbar with all required items.
	*/
	render: function () {
		var scroller = this,
			renderer = scroller.renderer,
			options = scroller.options,
			size = scroller.size,
			group;

		// Draw the scrollbar group
		scroller.group = group = renderer.g('scrollbar').attr({
			zIndex: options.zIndex,
			translateY: -99999
		}).add();

		// Draw the scrollbar track:
		scroller.track = renderer.rect()
			.addClass('highcharts-scrollbar-track')
			.attr({
				x: 0,
				r: options.trackBorderRadius || 0,
				height: size,
				width: size
			}).add(group);

		/*= if (build.classic) { =*/
		scroller.track.attr({
			fill: options.trackBackgroundColor,
			stroke: options.trackBorderColor,
			'stroke-width': options.trackBorderWidth
		});
		/*= } =*/
		this.trackBorderWidth = scroller.track.strokeWidth();
		scroller.track.attr({
			y: -this.trackBorderWidth % 2 / 2
		});


		// Draw the scrollbar itself
		scroller.scrollbarGroup = renderer.g().add(group);

		scroller.scrollbar = renderer.rect()
			.addClass('highcharts-scrollbar-thumb')
			.attr({
				height: size,
				width: size,
				r: options.barBorderRadius || 0
			}).add(scroller.scrollbarGroup);

		scroller.scrollbarRifles = renderer.path(scroller.swapXY([
				'M',
				-3, size / 4,
				'L',
				-3, 2 * size / 3,
				'M',
				0, size / 4,
				'L',
				0, 2 * size / 3,
				'M',
				3, size / 4,
				'L',
				3, 2 * size / 3
			], options.vertical))
			.addClass('highcharts-scrollbar-rifles')
			.add(scroller.scrollbarGroup);

		/*= if (build.classic) { =*/
		scroller.scrollbar.attr({
			fill: options.barBackgroundColor,
			stroke: options.barBorderColor,
			'stroke-width': options.barBorderWidth
		});
		scroller.scrollbarRifles.attr({
			stroke: options.rifleColor,
			'stroke-width': 1
		});
		/*= } =*/
		scroller.scrollbarStrokeWidth = scroller.scrollbar.strokeWidth();
		scroller.scrollbarGroup.translate(
			-scroller.scrollbarStrokeWidth % 2 / 2,
			-scroller.scrollbarStrokeWidth % 2 / 2
		);

		// Draw the buttons:
		scroller.drawScrollbarButton(0);
		scroller.drawScrollbarButton(1);
	},

	/**
	 * Position the scrollbar, method called from a parent with defined dimensions
	 * @param {Number} x - x-position on the chart
	 * @param {Number} y - y-position on the chart
	 * @param {Number} width - width of the scrollbar
	 * @param {Number} height - height of the scorllbar
	 */
	position: function (x, y, width, height) {
		var scroller = this,
			options = scroller.options,
			vertical = options.vertical,
			xOffset = height,
			yOffset = 0,
			method = scroller.rendered ? 'animate' : 'attr';

		if (this.group) { // May be destroyed or disabled

			scroller.x = x;
			scroller.y = y + this.trackBorderWidth;
			scroller.width = width; // width with buttons
			scroller.height = height;
			scroller.xOffset = xOffset;
			scroller.yOffset = yOffset;

			// If Scrollbar is a vertical type, swap options:
			if (vertical) {
				scroller.width = scroller.yOffset = width = yOffset = scroller.size;
				scroller.xOffset = xOffset = 0;
				scroller.barWidth = height - width * 2; // width without buttons
				scroller.x = x = x + scroller.options.margin;
			} else {
				scroller.height = scroller.xOffset = height = xOffset = scroller.size;
				scroller.barWidth = width - height * 2; // width without buttons
				scroller.y = scroller.y + scroller.options.margin;
			}

			// Set general position for a group:
			scroller.group[method]({
				translateX: x,
				translateY: scroller.y
			});

			// Resize background/track:
			scroller.track[method]({
				width: width,
				height: height
			});

			// Move right/bottom button ot it's place:
			scroller.scrollbarButtons[1].attr({
				translateX: vertical ? 0 : width - xOffset,
				translateY: vertical ? height - yOffset : 0
			});

			scroller.rendered = true;
		}
	},

	/**
	 * Draw the scrollbar buttons with arrows
	 * @param {Number} index 0 is left, 1 is right
	 */
	drawScrollbarButton: function (index) {
		var scroller = this,
			renderer = scroller.renderer,
			scrollbarButtons = scroller.scrollbarButtons,
			options = scroller.options,
			size = scroller.size,
			group,
			tempElem;

		group = renderer.g().add(scroller.group);
		scrollbarButtons.push(group);

		// Create a rectangle for the scrollbar button
		tempElem = renderer.rect()
			.addClass('highcharts-scrollbar-button')
			.add(group);

		/*= if (build.classic) { =*/
		// Presentational attributes
		tempElem.attr({
			stroke: options.buttonBorderColor,
			'stroke-width': options.buttonBorderWidth,
			fill: options.buttonBackgroundColor
		});
		/*= } =*/

		// Place the rectangle based on the rendered stroke width
		tempElem.attr(tempElem.crisp({
			x: -0.5,
			y: -0.5,
			width: size + 1, // +1 to compensate for crispifying in rect method
			height: size + 1,
			r: options.buttonBorderRadius
		}, tempElem.strokeWidth()));

		// Button arrow
		tempElem = renderer
			.path(scroller.swapXY([
				'M',
				size / 2 + (index ? -1 : 1), 
				size / 2 - 3,
				'L',
				size / 2 + (index ? -1 : 1), 
				size / 2 + 3,
				'L',
				size / 2 + (index ? 2 : -2), 
				size / 2
			], options.vertical))
			.addClass('highcharts-scrollbar-arrow')
			.add(scrollbarButtons[index]);

		/*= if (build.classic) { =*/
		tempElem.attr({
			fill: options.buttonArrowColor
		});
		/*= } =*/
	},

	/**
	* When we have vertical scrollbar, rifles are rotated, the same for arrow in buttons:
	* @param {Array} path - path to be rotated
	* @param {Boolean} vertical - if vertical scrollbar, swap x-y values
	*/
	swapXY: function (path, vertical) {
		var i,
			len = path.length,
			temp;

		if (vertical) {
			for (i = 0; i < len; i += 3) {
				temp = path[i + 1];
				path[i + 1] = path[i + 2];
				path[i + 2] = temp;
			}
		}

		return path;
	},

	/**
	* Set scrollbar size, with a given scale.
	* @param {Number} from - scale (0-1) where bar should start
	* @param {Number} to - scale (0-1) where bar should end
	*/
	setRange: function (from, to) {
		var scroller = this,
			options = scroller.options,
			vertical = options.vertical,
			fromPX,
			toPX,
			newPos,
			newSize,
			newRiflesPos;

		if (defined(scroller.barWidth) && scroller.group) {

			fromPX = scroller.barWidth * Math.max(from, 0);
			toPX = scroller.barWidth * Math.min(to, 1);
			newSize = Math.max(correctFloat(toPX - fromPX), options.minWidth);
			newPos = Math.floor(fromPX + scroller.xOffset + scroller.yOffset) - scroller.scrollbarStrokeWidth % 2 / 2;
			newRiflesPos = newSize / 2 - 0.5; // -0.5 -> rifle line width / 2

			// Store current position:
			scroller.from = from;
			scroller.to = to;

			if (!vertical) {
				scroller.scrollbarGroup.attr({
					translateX: newPos
				});
				scroller.scrollbar.attr({
					width: newSize
				});
				scroller.scrollbarRifles.attr({
					translateX: newRiflesPos
				});
				scroller.scrollbarLeft = newPos;
				scroller.scrollbarTop = 0;
			} else {
				scroller.scrollbarGroup.attr({
					translateY: newPos
				});
				scroller.scrollbar.attr({
					height: newSize
				});
				scroller.scrollbarRifles.attr({
					translateY: newRiflesPos
				});
				scroller.scrollbarTop = newPos;
				scroller.scrollbarLeft = 0;
			}

			if (newSize <= 12) {
				scroller.scrollbarRifles.hide();
			} else {
				scroller.scrollbarRifles.show(true);
			}

			// Show or hide the scrollbar based on the showFull setting
			if (options.showFull === false) {
				if (from <= 0 && to >= 1) {
					scroller.group.hide();
				} else {
					scroller.group.show();
				}
			}
		}
	},

	/**
	* Init events methods, so we have an access to the Scrollbar itself
	*/
	initEvents: function () {
		var scroller = this;
		/**
		 * Event handler for the mouse move event.
		 */
		scroller.mouseMoveHandler = function (e) {
			var normalizedEvent = scroller.chart.pointer.normalize(e),
				options = scroller.options,
				direction = options.vertical ? 'chartY' : 'chartX',
				initPositions = scroller.initPositions,
				scrollPosition,
				chartPosition,
				change;

			// In iOS, a mousemove event with e.pageX === 0 is fired when holding the finger
			// down in the center of the scrollbar. This should be ignored.
			if (scroller.grabbedCenter && (!e.touches || e.touches[0][direction] !== 0)) { // #4696, scrollbar failed on Android

				chartPosition = {
					chartX: (normalizedEvent.chartX - scroller.x - scroller.xOffset) / scroller.barWidth,
					chartY: (normalizedEvent.chartY - scroller.y - scroller.yOffset) / scroller.barWidth
				}[direction];
				scrollPosition = scroller[direction];

				change = chartPosition - scrollPosition;

				scroller.updatePosition(initPositions[0] + change, initPositions[1] + change);

				if (scroller.options.liveRedraw) {
					setTimeout(function () {
						scroller.mouseUpHandler(e);
					}, 0);
				} else {
					scroller.setRange(scroller.from, scroller.to);
				}

				scroller.hasDragged = true;
			}
		};

		/**
		 * Event handler for the mouse up event.
		 */
		scroller.mouseUpHandler = function (e) {
			if (scroller.hasDragged) {
				fireEvent(scroller, 'changed', {
					from: scroller.from,
					to: scroller.to,
					trigger: 'scrollbar',
					DOMEvent: e
				});
			}

			if (e.type !== 'mousemove') {
				scroller.grabbedCenter = scroller.hasDragged = scroller.chartX = scroller.chartY = null;
			}
		};

		scroller.mouseDownHandler = function (e) {
			var normalizedEvent = scroller.chart.pointer.normalize(e);

			scroller.chartX = (normalizedEvent.chartX - scroller.x - scroller.xOffset) / scroller.barWidth;
			scroller.chartY = (normalizedEvent.chartY - scroller.y - scroller.yOffset) / scroller.barWidth;
			scroller.initPositions = [scroller.from, scroller.to];

			scroller.grabbedCenter = true;
		};

		scroller.buttonToMinClick = function (e) {
			var range = correctFloat(scroller.to - scroller.from) * scroller.options.step;
			scroller.updatePosition(correctFloat(scroller.from - range), correctFloat(scroller.to - range));
			fireEvent(scroller, 'changed', {
				from: scroller.from,
				to: scroller.to,
				trigger: 'scrollbar',
				DOMEvent: e
			});
		};

		scroller.buttonToMaxClick = function (e) {
			var range = (scroller.to - scroller.from) * scroller.options.step;
			scroller.updatePosition(scroller.from + range, scroller.to + range);
			fireEvent(scroller, 'changed', {
				from: scroller.from,
				to: scroller.to,
				trigger: 'scrollbar',
				DOMEvent: e
			});
		};

		scroller.trackClick = function (e) {
			var normalizedEvent = scroller.chart.pointer.normalize(e),
				range = scroller.to - scroller.from,
				top = scroller.y + scroller.scrollbarTop,
				left = scroller.x + scroller.scrollbarLeft;

			if ((scroller.options.vertical && normalizedEvent.chartY > top) || 
				(!scroller.options.vertical && normalizedEvent.chartX > left)) {
				// On the top or on the left side of the track:
				scroller.updatePosition(scroller.from + range, scroller.to + range);
			} else {
				// On the bottom or the right side of the track:
				scroller.updatePosition(scroller.from - range, scroller.to - range);
			}

			fireEvent(scroller, 'changed', {
				from: scroller.from,
				to: scroller.to,
				trigger: 'scrollbar',
				DOMEvent: e
			});
		};
	},

	/**
	* Update position option in the Scrollbar, with normalized 0-1 scale
	*/
	updatePosition: function (from, to) {
		if (to > 1) {
			from = correctFloat(1 - correctFloat(to - from));
			to = 1;
		}

		if (from < 0) {
			to = correctFloat(to - from);
			from = 0;
		}

		this.from = from;
		this.to = to;
	},

	update: function (options) {
		this.destroy();
		this.init(this.chart.renderer, merge(true, this.options, options), this.chart);
	},

	/**
	 * Set up the mouse and touch events for the Scrollbar
	 */
	addEvents: function () {
		var buttonsOrder = this.options.inverted ? [1, 0] : [0, 1],
			buttons = this.scrollbarButtons,
			bar = this.scrollbarGroup.element,
			track = this.track.element,
			mouseDownHandler = this.mouseDownHandler,
			mouseMoveHandler = this.mouseMoveHandler,
			mouseUpHandler = this.mouseUpHandler,
			_events;

		// Mouse events
		_events = [
			[buttons[buttonsOrder[0]].element, 'click', this.buttonToMinClick],
			[buttons[buttonsOrder[1]].element, 'click', this.buttonToMaxClick],
			[track, 'click', this.trackClick],
			[bar, 'mousedown', mouseDownHandler],
			[doc, 'mousemove', mouseMoveHandler],
			[doc, 'mouseup', mouseUpHandler]
		];

		// Touch events
		if (hasTouch) {
			_events.push(
				[bar, 'touchstart', mouseDownHandler],
				[doc, 'touchmove', mouseMoveHandler],
				[doc, 'touchend', mouseUpHandler]
			);
		}

		// Add them all
		each(_events, function (args) {
			addEvent.apply(null, args);
		});
		this._events = _events;
	},

	/**
	 * Removes the event handlers attached previously with addEvents.
	 */
	removeEvents: function () {
		each(this._events, function (args) {
			removeEvent.apply(null, args);
		});
		this._events = undefined;
	},

	/**
	 * Destroys allocated elements.
	 */
	destroy: function () {
		var scroller = this;

		// Disconnect events added in addEvents
		scroller.removeEvents();

		// Destroy properties
		each(['track', 'scrollbarRifles', 'scrollbar', 'scrollbarGroup', 'group'], function (prop) {
			if (scroller[prop] && scroller[prop].destroy) {
				scroller[prop] = scroller[prop].destroy();
			}
		});

		// Destroy elements in collection
		destroyObjectProperties(scroller.scrollbarButtons);
	}
};

/**
* Wrap axis initialization and create scrollbar if enabled:
*/
wrap(Axis.prototype, 'init', function (proceed) {
	var axis = this;
	proceed.apply(axis, [].slice.call(arguments, 1));

	if (axis.options.scrollbar && axis.options.scrollbar.enabled) {
		// Predefined options:
		axis.options.scrollbar.vertical = !axis.horiz;
		axis.options.startOnTick = axis.options.endOnTick = false; // docs

		axis.scrollbar = new Scrollbar(axis.chart.renderer, axis.options.scrollbar, axis.chart);

		addEvent(axis.scrollbar, 'changed', function (e) {
			var unitedMin = Math.min(pick(axis.options.min, axis.min), axis.min, axis.dataMin),
				unitedMax = Math.max(pick(axis.options.max, axis.max), axis.max, axis.dataMax),
				range = unitedMax - unitedMin,
				to,
				from;

			if ((axis.horiz && !axis.reversed) || (!axis.horiz && axis.reversed)) {
				to = unitedMin + range * this.to;
				from = unitedMin + range * this.from;
			} else {
				// y-values in browser are reversed, but this also applies for reversed horizontal axis:
				to = unitedMin + range * (1 - this.from);
				from = unitedMin + range * (1 - this.to);
			}

			axis.setExtremes(from, to, true, false, e);
		});
	}
});

/**
* Wrap rendering axis, and update scrollbar if one is created:
*/
wrap(Axis.prototype, 'render', function (proceed) {
	var axis = this,		
		scrollMin = Math.min(pick(axis.options.min, axis.min), axis.min, axis.dataMin),
		scrollMax = Math.max(pick(axis.options.max, axis.max), axis.max, axis.dataMax),
		scrollbar = axis.scrollbar,
		from,
		to;

	proceed.apply(axis, [].slice.call(arguments, 1));

	if (scrollbar) {
		if (axis.horiz) {
			scrollbar.position(
				axis.left, 
				axis.top + axis.height + axis.offset + 2 + (axis.opposite ? 0 : axis.axisTitleMargin),
				axis.width,
				axis.height
			);
		} else {
			scrollbar.position(
				axis.left + axis.width + 2 + axis.offset + (axis.opposite ? axis.axisTitleMargin : 0), 
				axis.top, 
				axis.width, 
				axis.height
			);
		}

		if (isNaN(scrollMin) || isNaN(scrollMax) || !defined(axis.min) || !defined(axis.max)) {
			scrollbar.setRange(0, 0); // default action: when there is not extremes on the axis, but scrollbar exists, make it full size
		} else {
			from = (axis.min - scrollMin) / (scrollMax - scrollMin);
			to = (axis.max - scrollMin) / (scrollMax - scrollMin);

			if ((axis.horiz && !axis.reversed) || (!axis.horiz && axis.reversed)) {
				scrollbar.setRange(from, to);
			} else {
				scrollbar.setRange(1 - to, 1 - from); // inverse vertical axis
			}
		}
	}
});

/**
* Make space for a scrollbar
*/
wrap(Axis.prototype, 'getOffset', function (proceed) {
	var axis = this,
		index = axis.horiz ? 2 : 1,
		scrollbar = axis.scrollbar;

	proceed.apply(axis, [].slice.call(arguments, 1));

	if (scrollbar) {
		axis.chart.axisOffset[index] += scrollbar.size + scrollbar.options.margin;
	}
});

/**
* Destroy scrollbar when connected to the specific axis
*/
wrap(Axis.prototype, 'destroy', function (proceed) {
	if (this.scrollbar) {
		this.scrollbar = this.scrollbar.destroy();
	}

	proceed.apply(this, [].slice.call(arguments, 1));
});

Highcharts.Scrollbar = Scrollbar;


	return H;
}(Highcharts));