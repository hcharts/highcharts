/**
 * (c) 2010-2017 Torstein Honsi
 *
 * License: www.highcharts.com/license
 */
/* eslint max-len: ["warn", 80, 4] */
'use strict';
import H from './Globals.js';

/**
 * The Highcharts object is the placeholder for all other members, and various
 * utility functions. The most important member of the namespace would be the
 * chart constructor.
 *
 * @example
 * var chart = Highcharts.chart('container', { ... });
 * 
 * @namespace Highcharts
 */

H.timers = [];

var charts = H.charts,
	doc = H.doc,
	win = H.win;

/**
 * Provide error messages for debugging, with links to online explanation. This
 * function can be overridden to provide custom error handling.
 *
 * @function #error
 * @memberOf Highcharts
 * @param {Number|String} code - The error code. See [errors.xml]{@link 
 *     https://github.com/highcharts/highcharts/blob/master/errors/errors.xml}
 *     for available codes. If it is a string, the error message is printed
 *     directly in the console.
 * @param {Boolean} [stop=false] - Whether to throw an error or just log a 
 *     warning in the console.
 *
 * @sample highcharts/chart/highcharts-error/ Custom error handler
 */
H.error = function (code, stop) {
	var msg = H.isNumber(code) ?
		'Highcharts error #' + code + ': https://www.hcharts.cn/errors/' + code :
		code;
	if (stop) {
		throw new Error(msg);
	}
	// else ...
	if (win.console) {
		console.log(msg); // eslint-disable-line no-console
	}
};

/**
 * An animator object used internally. One instance applies to one property
 * (attribute or style prop) on one element. Animation is always initiated
 * through {@link SVGElement#animate}.
 *
 * @constructor Fx
 * @memberOf Highcharts
 * @param {HTMLDOMElement|SVGElement} elem - The element to animate.
 * @param {AnimationOptions} options - Animation options.
 * @param {string} prop - The single attribute or CSS property to animate.
 * @private
 *
 * @example
 * var rect = renderer.rect(0, 0, 10, 10).add();
 * rect.animate({ width: 100 });
 */
H.Fx = function (elem, options, prop) {
	this.options = options;
	this.elem = elem;
	this.prop = prop;
};
H.Fx.prototype = {
	
	/**
	 * Set the current step of a path definition on SVGElement.
	 *
	 * @function #dSetter
	 * @memberOf Highcharts.Fx
	 */
	dSetter: function () {
		var start = this.paths[0],
			end = this.paths[1],
			ret = [],
			now = this.now,
			i = start.length,
			startVal;

		// Land on the final path without adjustment points appended in the ends
		if (now === 1) {
			ret = this.toD;

		} else if (i === end.length && now < 1) {
			while (i--) {
				startVal = parseFloat(start[i]);
				ret[i] =
					isNaN(startVal) ? // a letter instruction like M or L
							end[i] :
							now * (parseFloat(end[i] - startVal)) + startVal;

			}
		// If animation is finished or length not matching, land on right value
		} else {
			ret = end;
		}
		this.elem.attr('d', ret, null, true);
	},

	/**
	 * Update the element with the current animation step.
	 *
	 * @function #update
	 * @memberOf Highcharts.Fx
	 */
	update: function () {
		var elem = this.elem,
			prop = this.prop, // if destroyed, it is null
			now = this.now,
			step = this.options.step;

		// Animation setter defined from outside
		if (this[prop + 'Setter']) {
			this[prop + 'Setter']();

		// Other animations on SVGElement
		} else if (elem.attr) {
			if (elem.element) {
				elem.attr(prop, now, null, true);
			}

		// HTML styles, raw HTML content like container size
		} else {
			elem.style[prop] = now + this.unit;
		}
		
		if (step) {
			step.call(elem, now, this);
		}

	},

	/**
	 * Run an animation.
	 *
	 * @function #run
	 * @memberOf Highcharts.Fx
	 * @param {Number} from - The current value, value to start from.
	 * @param {Number} to - The end value, value to land on.
	 * @param {String} [unit] - The property unit, for example `px`.
	 * 
	 */
	run: function (from, to, unit) {
		var self = this,
			options = self.options,
			timer = function (gotoEnd) {
				return timer.stopped ? false : self.step(gotoEnd);
			},
			requestAnimationFrame =
				win.requestAnimationFrame ||
				function (step) {
					setTimeout(step, 13);
				},
			step = function () {
				for (var i = 0; i < H.timers.length; i++) {
					if (!H.timers[i]()) {
						H.timers.splice(i--, 1);
					}
				}

				if (H.timers.length) {
					requestAnimationFrame(step);
				}
			};

		if (from === to) {
			delete options.curAnim[this.prop];
			if (options.complete && H.keys(options.curAnim).length === 0) {
				options.complete.call(this.elem);
			}
		} else { // #7166
			this.startTime = +new Date();
			this.start = from;
			this.end = to;
			this.unit = unit;
			this.now = this.start;
			this.pos = 0;

			timer.elem = this.elem;
			timer.prop = this.prop;

			if (timer() && H.timers.push(timer) === 1) {
				requestAnimationFrame(step);
			}
		}
	},
	
	/**
	 * Run a single step in the animation.
	 *
	 * @function #step
	 * @memberOf Highcharts.Fx
	 * @param   {Boolean} [gotoEnd] - Whether to go to the endpoint of the
	 *     animation after abort.
	 * @returns {Boolean} Returns `true` if animation continues.
	 */
	step: function (gotoEnd) {
		var t = +new Date(),
			ret,
			done,
			options = this.options,
			elem = this.elem,
			complete = options.complete,
			duration = options.duration,
			curAnim = options.curAnim;

		if (elem.attr && !elem.element) { // #2616, element is destroyed
			ret = false;

		} else if (gotoEnd || t >= duration + this.startTime) {
			this.now = this.end;
			this.pos = 1;
			this.update();

			curAnim[this.prop] = true;

			done = true;
			
			H.objectEach(curAnim, function (val) {
				if (val !== true) {
					done = false;
				}
			});

			if (done && complete) {
				complete.call(elem);
			}
			ret = false;

		} else {
			this.pos = options.easing((t - this.startTime) / duration);
			this.now = this.start + ((this.end - this.start) * this.pos);
			this.update();
			ret = true;
		}
		return ret;
	},

	/**
	 * Prepare start and end values so that the path can be animated one to one.
	 *
	 * @function #initPath
	 * @memberOf Highcharts.Fx
	 * @param {SVGElement} elem - The SVGElement item.
	 * @param {String} fromD - Starting path definition.
	 * @param {Array} toD - Ending path definition.
	 * @returns {Array} An array containing start and end paths in array form
	 * so that they can be animated in parallel.
	 */
	initPath: function (elem, fromD, toD) {
		fromD = fromD || '';
		var shift,
			startX = elem.startX,
			endX = elem.endX,
			bezier = fromD.indexOf('C') > -1,
			numParams = bezier ? 7 : 3,
			fullLength,
			slice,
			i,
			start = fromD.split(' '),
			end = toD.slice(), // copy
			isArea = elem.isArea,
			positionFactor = isArea ? 2 : 1,
			reverse;

		/**
		 * In splines make moveTo and lineTo points have six parameters like
		 * bezier curves, to allow animation one-to-one.
		 */
		function sixify(arr) {
			var isOperator,
				nextIsOperator;
			i = arr.length;
			while (i--) {

				// Fill in dummy coordinates only if the next operator comes
				// three places behind (#5788)
				isOperator = arr[i] === 'M' || arr[i] === 'L';
				nextIsOperator = /[a-zA-Z]/.test(arr[i + 3]);
				if (isOperator && nextIsOperator) {
					arr.splice(
						i + 1, 0,
						arr[i + 1], arr[i + 2],
						arr[i + 1], arr[i + 2]
					);
				}
			}
		}

		/**
		 * Insert an array at the given position of another array
		 */
		function insertSlice(arr, subArr, index) {
			[].splice.apply(
				arr,
				[index, 0].concat(subArr)
			);
		}

		/**
		 * If shifting points, prepend a dummy point to the end path. 
		 */
		function prepend(arr, other) {
			while (arr.length < fullLength) {
				
				// Move to, line to or curve to?
				arr[0] = other[fullLength - arr.length];

				// Prepend a copy of the first point
				insertSlice(arr, arr.slice(0, numParams), 0);	

				// For areas, the bottom path goes back again to the left, so we
				// need to append a copy of the last point.
				if (isArea) {
					insertSlice(
						arr,
						arr.slice(arr.length - numParams), arr.length
					);
					i--;
				}
			}
			arr[0] = 'M';
		}

		/**
		 * Copy and append last point until the length matches the end length
		 */
		function append(arr, other) {
			var i = (fullLength - arr.length) / numParams;
			while (i > 0 && i--) {

				// Pull out the slice that is going to be appended or inserted.
				// In a line graph, the positionFactor is 1, and the last point
				// is sliced out. In an area graph, the positionFactor is 2,
				// causing the middle two points to be sliced out, since an area
				// path starts at left, follows the upper path then turns and
				// follows the bottom back. 
				slice = arr.slice().splice(
					(arr.length / positionFactor) - numParams, 
					numParams * positionFactor
				);

				// Move to, line to or curve to?
				slice[0] = other[fullLength - numParams - (i * numParams)];
				
				// Disable first control point
				if (bezier) {
					slice[numParams - 6] = slice[numParams - 2];
					slice[numParams - 5] = slice[numParams - 1];
				}
				
				// Now insert the slice, either in the middle (for areas) or at
				// the end (for lines)
				insertSlice(arr, slice, arr.length / positionFactor);

				if (isArea) {
					i--;
				}
			}
		}

		if (bezier) {
			sixify(start);
			sixify(end);
		}

		// For sideways animation, find out how much we need to shift to get the
		// start path Xs to match the end path Xs.
		if (startX && endX) {
			for (i = 0; i < startX.length; i++) {
				// Moving left, new points coming in on right
				if (startX[i] === endX[0]) {
					shift = i;
					break;
				// Moving right
				} else if (startX[0] ===
						endX[endX.length - startX.length + i]) {
					shift = i;
					reverse = true;
					break;
				}
			}
			if (shift === undefined) {
				start = [];
			}
		}

		if (start.length && H.isNumber(shift)) {

			// The common target length for the start and end array, where both 
			// arrays are padded in opposite ends
			fullLength = end.length + shift * positionFactor * numParams;
			
			if (!reverse) {
				prepend(end, start);
				append(start, end);
			} else {
				prepend(start, end);
				append(end, start);
			}
		}

		return [start, end];
	}
}; // End of Fx prototype

/**
 * Handle animation of the color attributes directly.
 */
H.Fx.prototype.fillSetter = 
H.Fx.prototype.strokeSetter = function () {
	this.elem.attr(
		this.prop,
		H.color(this.start).tweenTo(H.color(this.end), this.pos),
		null,
		true
	);
};

<<<<<<< HEAD
/**
 * 对象复制（浅拷贝）
 *
 * @function #extend
 * @memberOf Highcharts
 * @param {Object} a - The object to be extended.
 * @param {Object} b - The object to add to the first one.
 * @returns {Object} Object a, the original object.
 */
H.extend = function (a, b) {
	var n;
	if (!a) {
		a = {};
	}
	for (n in b) {
		a[n] = b[n];
	}
	return a;
};
=======
>>>>>>> upstream/master

/**
 * 深拷贝多个对象。
 * 
 * Utility function to deep merge two or more objects and return a third object.
 * If the first argument is true, the contents of the second object is copied
 * into the first object. The merge function can also be used with a single 
 * object argument to create a deep copy of an object.
 *
 * @function #merge
 * @memberOf Highcharts
 * @param {Boolean} [extend] - Whether to extend the left-side object (a) or
		  return a whole new object.
 * @param {Object} a - The first object to extend. When only this is given, the
		  function returns a deep copy.
 * @param {...Object} [n] - An object to merge into the previous one.
 * @returns {Object} - The merged object. If the first argument is true, the 
 * return is the same as the second argument.
 */
H.merge = function () {
	var i,
		args = arguments,
		len,
		ret = {},
		doCopy = function (copy, original) {
			// An object is replacing a primitive
			if (typeof copy !== 'object') {
				copy = {};
			}

			H.objectEach(original, function (value, key) {
				
				// Copy the contents of objects, but not arrays or DOM nodes
				if (
						H.isObject(value, true) &&
						!H.isClass(value) &&
						!H.isDOMElement(value)
				) {
					copy[key] = doCopy(copy[key] || {}, value);

				// Primitives and arrays are copied over directly
				} else {
					copy[key] = original[key];
				}
			});
			return copy;
		};

	// If first argument is true, copy into the existing object. Used in
	// setOptions.
	if (args[0] === true) {
		ret = args[1];
		args = Array.prototype.slice.call(args, 2);
	}

	// For each argument, extend the return
	len = args.length;
	for (i = 0; i < len; i++) {
		ret = doCopy(ret, args[i]);
	}

	return ret;
};

/**
 * parseInt 的缩写形式
 * @ignore
 * @param {Object} s
 * @param {Number} mag Magnitude
 */
H.pInt = function (s, mag) {
	return parseInt(s, mag || 10);
};

/**
 * 检查是否是字符串类型
 *
 * @function #isString
 * @memberOf Highcharts
 * @param {Object} s - 需要检查的对象
 * @returns {Boolean} - 当对象是字符串是返回 True
 */
H.isString = function (s) {
	return typeof s === 'string';
};

/**
 * 数组判定
 *
 * 检查给定的内容是否是数组
 *
 * @function #isArray
 * @memberOf Highcharts
 * @param {Object} obj - 需要检查的内容
 * @returns {Boolean} - 对象是数组类型则返回 true，否则返回 false。
 */
H.isArray = function (obj) {
	var str = Object.prototype.toString.call(obj);
	return str === '[object Array]' || str === '[object Array Iterator]';
};

/**
 * 对象判定
 * 
 * 检查给定的内容是否是对象
 *
 * @function #isObject
 * @memberOf Highcharts
 * @param {Object} obj - 需要检查的内容
 * @param {Boolean} [strict=false] - Also checks that the object is not an
 *    array.
 * @returns {Boolean} - True if the argument is an object.
 */
H.isObject = function (obj, strict) {
	return !!obj && typeof obj === 'object' && (!strict || !H.isArray(obj));
};

/**
 * HTML Dom 判定
 * 
 * Utility function to check if an Object is a HTML Element.
 *
 * @function #isDOMElement
 * @memberOf Highcharts
 * @param {Object} obj - The item to check.
 * @returns {Boolean} - True if the argument is a HTML Element.
 */
H.isDOMElement = function (obj) {
	return H.isObject(obj) && typeof obj.nodeType === 'number';
};

/**
 * 类判定
 * 
 * Utility function to check if an Object is an class.
 *
 * @function #isClass
 * @memberOf Highcharts
 * @param {Object} obj - The item to check.
 * @returns {Boolean} - True if the argument is an class.
 */
H.isClass = function (obj) {
	var c = obj && obj.constructor;
	return !!(
		H.isObject(obj, true) &&
		!H.isDOMElement(obj) &&
		(c && c.name && c.name !== 'Object')
	);
};

/**
<<<<<<< HEAD
 * 数值判定
 * 
 * Utility function to check if an item is of type number.
=======
 * Utility function to check if an item is a number and it is finite (not NaN,
 * Infinity or -Infinity).
>>>>>>> upstream/master
 *
 * @function #isNumber
 * @memberOf Highcharts
 * @param  {Object} n
 *         The item to check.
 * @return {Boolean}
 *         True if the item is a finite number
 */
H.isNumber = function (n) {
	return typeof n === 'number' && !isNaN(n) && n < Infinity && n > -Infinity;
};

/**
 * Remove the last occurence of an item from an array.
 *
 * @function #erase
 * @memberOf Highcharts
 * @param {Array} arr - The array.
 * @param {*} item - The item to remove.
 */
H.erase = function (arr, item) {
	var i = arr.length;
	while (i--) {
		if (arr[i] === item) {
			arr.splice(i, 1);
			break;
		}
	}
};

/**
 * 检查对象是否为 null 或 undefined 
 *
 * @function #defined
 * @memberOf Highcharts
 * @param {Object} obj - The object to check.
 * @returns {Boolean} - 对象为 null 或 undefined 是返回 false，否则返回 true。
 */
H.defined = function (obj) {
	return obj !== undefined && obj !== null;
};

/**
 * 设置或获取对象的属性。
 * 
 * 当设置属性时，请传递第二个和第三个参数，或将第二个参数写成对象形式。如果是获取属性，只需要传递第二个参数。
 *
 * @function #attr
 * @memberOf Highcharts
 * @param {Object} elem - 需要获取或设置属性的 DOM
 * @param {String|Object} [prop] - 属性或键值对形式的属性值。
 * @param {String} [value] - 属性对应的值（prop 为单个属性的时候有效）
 * @returns {*} 当用于获取属性值时，返回对应的属性值。
 */
H.attr = function (elem, prop, value) {
	var ret;

	// if the prop is a string
	if (H.isString(prop)) {
		// set the value
		if (H.defined(value)) {
			elem.setAttribute(prop, value);

		// get the value
		} else if (elem && elem.getAttribute) {
			ret = elem.getAttribute(prop);
		}

	// else if prop is defined, it is a hash of key/value pairs
	} else if (H.defined(prop) && H.isObject(prop)) {
		H.objectEach(prop, function (val, key) {
			elem.setAttribute(key, val);
		});
	}
	return ret;
};

/**
 * 检查内容是否为数组，如果不是，则包装成数组
 *
 * @function #splat
 * @memberOf Highcharts
 * @param obj {*} - The object to splat.
 * @returns {Array} The produced or original array.
 */
H.splat = function (obj) {
	return H.isArray(obj) ? obj : [obj];
};

/**
 * 延迟执行函数。
 * 
 * 当指定了延迟时间，则在 setTimeout 中执行这个函数，没有指定则是直接执行这个函数
 *
 * @function #syncTimeout
 * @memberOf Highcharts
 * @param   {Function} fn - The function callback.
 * @param   {Number}   delay - Delay in milliseconds.
 * @param   {Object}   [context] - The context.
 * @returns {Number} timeout 函数的标识对象，用于后续的清除操作。
 * with clearTimeout.
 */
H.syncTimeout = function (fn, delay, context) {
	if (delay) {
		return setTimeout(fn, delay, context);
	}
	fn.call(0, context);
};


/**
<<<<<<< HEAD
 * 返回第一个不为 null 或 undefined 的参数
=======
 * Utility function to extend an object with the members of another.
 *
 * @function #extend
 * @memberOf Highcharts
 * @param {Object} a - The object to be extended.
 * @param {Object} b - The object to add to the first one.
 * @returns {Object} Object a, the original object.
 */
H.extend = function (a, b) {
	var n;
	if (!a) {
		a = {};
	}
	for (n in b) {
		a[n] = b[n];
	}
	return a;
};


/**
 * Return the first value that is not null or undefined.
>>>>>>> upstream/master
 *
 * @function #pick
 * @memberOf Highcharts
 * @param {...*} items - Variable number of arguments to inspect.
 * @returns {*} The value of the first argument that is not null or undefined.
 */
H.pick = function () {
	var args = arguments,
		i,
		arg,
		length = args.length;
	for (i = 0; i < length; i++) {
		arg = args[i];
		if (arg !== undefined && arg !== null) {
			return arg;
		}
	}
};

/**
 * @typedef {Object} CSSObject - A style object with camel case property names.
 * The properties can be whatever styles are supported on the given SVG or HTML
 * element.
 * @example
 * {
 *    fontFamily: 'monospace',
 *    fontSize: '1.2em'
 * }
 */
/**
 * 给指定的 DOM 设置 CSS 样式
 *
 * @function #css
 * @memberOf Highcharts
 * @param {HTMLDOMElement} el - HTML DOM 对象
 * @param {CSSObject} styles - 样式对象，注意属性的名字是以驼峰命名的，例如 `fontSize`。
 * 
 */
H.css = function (el, styles) {
	if (H.isMS && !H.svg) { // #2686
		if (styles && styles.opacity !== undefined) {
			styles.filter = 'alpha(opacity=' + (styles.opacity * 100) + ')';
		}
	}
	H.extend(el.style, styles);
};

/**
 * HTML DOM
 * @typedef {Object} HTMLDOMElement
 */

/**
 * 用于创建 HTML DOM 的工具函数，同时可以指定 DOM 的属性和样式
 *
 * @function #createElement
 * @memberOf Highcharts
 * @param {String} tag - HTML 标签.
 * @param {Object} [attribs] - 属性，对象形式。
 * @param {CSSObject} [styles] - 样式，对象形式。
 * @param {Object} [parent] - 父级 DOM.
 * @param {Boolean} [nopad=false] - 是否去掉边距，如果为 true ，则去掉所有的 padding，margin 及边框
 * @returns {HTMLDOMElement} 创建的 DOM
 */
H.createElement = function (tag, attribs, styles, parent, nopad) {
	var el = doc.createElement(tag),
		css = H.css;
	if (attribs) {
		H.extend(el, attribs);
	}
	if (nopad) {
		css(el, { padding: 0, border: 'none', margin: 0 });
	}
	if (styles) {
		css(el, styles);
	}
	if (parent) {
		parent.appendChild(el);
	}
	return el;
};

/**
 * Extend a prototyped class by new members.
 *
 * @function #extendClass
 * @memberOf Highcharts
 * @param {Object} parent - The parent prototype to inherit.
 * @param {Object} members - A collection of prototype members to add or
 *        override compared to the parent prototype.
 * @returns {Object} A new prototype.
 */
H.extendClass = function (parent, members) {
	var object = function () {};
	object.prototype = new parent(); // eslint-disable-line new-cap
	H.extend(object.prototype, members);
	return object;
};

/**
 * Left-pad a string to a given length by adding a character repetetively.
 *
 * @function #pad
 * @memberOf Highcharts
 * @param {Number} number - The input string or number.
 * @param {Number} length - The desired string length.
 * @param {String} [padder=0] - The character to pad with.
 * @returns {String} The padded string.
 */
H.pad = function (number, length, padder) {
	return new Array((length || 2) + 1 -
		String(number).length).join(padder || 0) + number;
};

/**
 * @typedef {Number|String} RelativeSize - If a number is given, it defines the
 *    pixel length. If a percentage string is given, like for example `'50%'`,
 *    the setting defines a length relative to a base size, for example the size
 *    of a container.
 */
/**
 * Return a length based on either the integer value, or a percentage of a base.
 *
 * @function #relativeLength
 * @memberOf Highcharts
 * @param  {RelativeSize} value
 *         A percentage string or a number.
 * @param  {number} base
 *         The full length that represents 100%.
 * @param  {number} [offset=0]
 *         A pixel offset to apply for percentage values. Used internally in 
 *         axis positioning.
 * @return {number}
 *         The computed length.
 */
H.relativeLength = function (value, base, offset) {
	return (/%$/).test(value) ?
		(base * parseFloat(value) / 100) + (offset || 0) :
		parseFloat(value);
};

/**
 * Wrap a method with extended functionality, preserving the original function.
 *
 * @function #wrap
 * @memberOf Highcharts
 * @param {Object} obj - The context object that the method belongs to. In real
 *        cases, this is often a prototype.
 * @param {String} method - The name of the method to extend.
 * @param {Function} func - A wrapper function callback. This function is called
 *        with the same arguments as the original function, except that the
 *        original function is unshifted and passed as the first argument.
 * 
 */
H.wrap = function (obj, method, func) {
	var proceed = obj[method];
	obj[method] = function () {
		var args = Array.prototype.slice.call(arguments),
			outerArgs = arguments,
			ctx = this,
			ret;
		ctx.proceed = function () {
			proceed.apply(ctx, arguments.length ? arguments : outerArgs);
		};
		args.unshift(proceed);
		ret = func.apply(this, args);
		ctx.proceed = null;
		return ret;
	};
};

<<<<<<< HEAD
/**
 * 根据全局配置获取当前的时区信息。
 * Get the time zone offset based on the current timezone information as set in
 * the global options.
 *
 * @function #getTZOffset
 * @memberOf Highcharts
 * @param  {Number} timestamp - The JavaScript timestamp to inspect.
 * @return {Number} - The timezone offset in minutes compared to UTC.
 */
H.getTZOffset = function (timestamp) {
	var d = H.Date;
	return ((d.hcGetTimezoneOffset && d.hcGetTimezoneOffset(timestamp)) ||
		d.hcTimezoneOffset || 0) * 60000;
};

/**
 * 时间格式化函数
 * 将 JavaScript 时间戳 （ 1970 年 1月到现在的毫秒数）转换成更易读的形式（例如 2017/01/01 这种形式）。
 * 其中 `format` 参数是 PHP 时间格式化字符的子集
 * [strftime]{@link
 * http://www.php.net/manual/en/function.strftime.php}。
 * 另外可以通过 {@link Highcharts.dateFormats} 来自定义格式化字符。
 *
 * @function #dateFormat
 * @memberOf Highcharts
 * @param {String} format - 以 % 开头的时间格式化字符。
 * @param {Number} timestamp - JavaScript 时间戳
 * @param {Boolean} [capitalize=false] - 是否以首字母大写的形式返回结果（用于英文）
 * @returns {String} 格式化后的字符串
 */
H.dateFormat = function (format, timestamp, capitalize) {
	if (!H.defined(timestamp) || isNaN(timestamp)) {
		return H.defaultOptions.lang.invalidDate || '';
	}
	format = H.pick(format, '%Y-%m-%d %H:%M:%S');

	var D = H.Date,
		date = new D(timestamp - H.getTZOffset(timestamp)),
		// get the basic time values
		hours = date[D.hcGetHours](),
		day = date[D.hcGetDay](),
		dayOfMonth = date[D.hcGetDate](),
		month = date[D.hcGetMonth](),
		fullYear = date[D.hcGetFullYear](),
		lang = H.defaultOptions.lang,
		langWeekdays = lang.weekdays,
		shortWeekdays = lang.shortWeekdays,
		pad = H.pad,

		// List all format keys. Custom formats can be added from the outside. 
		replacements = H.extend(
			{

				// Day
				// Short weekday, like 'Mon'
				'a': shortWeekdays ?
					shortWeekdays[day] :
					langWeekdays[day].substr(0, 3),
				// Long weekday, like 'Monday'
				'A': langWeekdays[day],
				// Two digit day of the month, 01 to 31
				'd': pad(dayOfMonth),
				// Day of the month, 1 through 31
				'e': pad(dayOfMonth, 2, ' '),
				'w': day,

				// Week (none implemented)
				// 'W': weekNumber(),

				// Month
				// Short month, like 'Jan'
				'b': lang.shortMonths[month],
				// Long month, like 'January'
				'B': lang.months[month],
				// Two digit month number, 01 through 12
				'm': pad(month + 1),

				// Year
				// Two digits year, like 09 for 2009
				'y': fullYear.toString().substr(2, 2),
				// Four digits year, like 2009
				'Y': fullYear,

				// Time
				// Two digits hours in 24h format, 00 through 23
				'H': pad(hours),
				// Hours in 24h format, 0 through 23
				'k': hours,
				// Two digits hours in 12h format, 00 through 11
				'I': pad((hours % 12) || 12),
				// Hours in 12h format, 1 through 12
				'l': (hours % 12) || 12,
				// Two digits minutes, 00 through 59
				'M': pad(date[D.hcGetMinutes]()),
				// Upper case AM or PM
				'p': hours < 12 ? 'AM' : 'PM',
				// Lower case AM or PM
				'P': hours < 12 ? 'am' : 'pm',
				// Two digits seconds, 00 through  59
				'S': pad(date.getSeconds()),
				// Milliseconds (naming from Ruby)
				'L': pad(Math.round(timestamp % 1000), 3)
			},
			
			/**
			 * A hook for defining additional date format specifiers. New
			 * specifiers are defined as key-value pairs by using the specifier
			 * as key, and a function which takes the timestamp as value. This
			 * function returns the formatted portion of the date.
			 *
			 * @type {Object}
			 * @name dateFormats
			 * @memberOf Highcharts
			 * @sample highcharts/global/dateformats/ Adding support for week
			 * number
			 */
			H.dateFormats
		);


	// Do the replaces
	H.objectEach(replacements, function (val, key) {
		// Regex would do it in one line, but this is faster
		while (format.indexOf('%' + key) !== -1) {
			format = format.replace(
				'%' + key,
				typeof val === 'function' ? val(timestamp) : val
			);
		}
		
	});

	// Optionally capitalize the string and return
	return capitalize ?
		format.substr(0, 1).toUpperCase() + format.substr(1) :
		format;
};
=======

>>>>>>> upstream/master

/**
 * 格式化单个变量，类似 C 语言中 printf 用法
 *
 * @example
 * formatSingle('.2f', 5); // => '5.00'.
 *
 * @function #formatSingle
 * @memberOf Highcharts
 * @param {String} format The format string.
 * @param {*} val The value.
 * @param {Time}   [time]
 *        A `Time` instance that determines the date formatting, for example for
 *        applying time zone corrections to the formatted date.
 
 * @returns {String} The formatted representation of the value.
 */
H.formatSingle = function (format, val, time) {
	var floatRegex = /f$/,
		decRegex = /\.([0-9])/,
		lang = H.defaultOptions.lang,
		decimals;

	if (floatRegex.test(format)) { // float
		decimals = format.match(decRegex);
		decimals = decimals ? decimals[1] : -1;
		if (val !== null) {
			val = H.numberFormat(
				val,
				decimals,
				lang.decimalPoint,
				format.indexOf(',') > -1 ? lang.thousandsSep : ''
			);
		}
	} else {
		val = (time || H.time).dateFormat(format, val);
	}
	return val;
};

/**
 * 字符串格式化函数
 * 
 * 其格式化规则是 Python 中的 String.format 的子集
 *
 * @function #format
 * @memberOf Highcharts
<<<<<<< HEAD
 * @param {String} str 需要格式化的字符串。
 * @param {Object} ctx 需要替换的内容，是键值对的形式。
 * @returns {String} 格式化后的字符串。
=======
 * @param {String} str
 *        The string to format.
 * @param {Object} ctx
 *        The context, a collection of key-value pairs where each key is
 *        replaced by its value.
 * @param {Time}   [time]
 *        A `Time` instance that determines the date formatting, for example for
 *        applying time zone corrections to the formatted date.
 * @returns {String} The formatted string.
>>>>>>> upstream/master
 *
 * @example
 * var s = Highcharts.format(
 *     'The {color} fox was {len:.2f} feet long',
 *     { color: 'red', len: Math.PI }
 * );
 * // => The red fox was 3.14 feet long
 */
H.format = function (str, ctx, time) {
	var splitter = '{',
		isInside = false,
		segment,
		valueAndFormat,
		path,
		i,
		len,
		ret = [],
		val,
		index;

	while (str) {
		index = str.indexOf(splitter);
		if (index === -1) {
			break;
		}

		segment = str.slice(0, index);
		if (isInside) { // we're on the closing bracket looking back

			valueAndFormat = segment.split(':');
			path = valueAndFormat.shift().split('.'); // get first and leave
			len = path.length;
			val = ctx;

			// Assign deeper paths
			for (i = 0; i < len; i++) {
				if (val) {
					val = val[path[i]];
				}
			}

			// Format the replacement
			if (valueAndFormat.length) {
				val = H.formatSingle(valueAndFormat.join(':'), val, time);
			}

			// Push the result and advance the cursor
			ret.push(val);

		} else {
			ret.push(segment);

		}
		str = str.slice(index + 1); // the rest
		isInside = !isInside; // toggle
		splitter = isInside ? '}' : '{'; // now look for next matching bracket
	}
	ret.push(str);
	return ret.join('');
};

/**
 * 获取数值的数量级
 *
 * @function #getMagnitude
 * @memberOf Highcharts
 * @param {Number} 数值.
 * @returns {Number} 数量级，例如 1-9 的数量级是 1， 10-99 的数量级是 2
 */
H.getMagnitude = function (num) {
	return Math.pow(10, Math.floor(Math.log(num) / Math.LN10));
};

/**
 * Take an interval and normalize it to multiples of round numbers.
 *
 * @todo  Move this function to the Axis prototype. It is here only for
 *        historical reasons.
 * @function #normalizeTickInterval
 * @memberOf Highcharts
 * @param {Number} interval - The raw, un-rounded interval.
 * @param {Array} [multiples] - Allowed multiples.
 * @param {Number} [magnitude] - The magnitude of the number.
 * @param {Boolean} [allowDecimals] - Whether to allow decimals.
 * @param {Boolean} [hasTickAmount] - If it has tickAmount, avoid landing
 *        on tick intervals lower than original.
 * @returns {Number} The normalized interval.
 */
H.normalizeTickInterval = function (interval, multiples, magnitude,
		allowDecimals, hasTickAmount) {
	var normalized, 
		i,
		retInterval = interval;

	// round to a tenfold of 1, 2, 2.5 or 5
	magnitude = H.pick(magnitude, 1);
	normalized = interval / magnitude;

	// multiples for a linear scale
	if (!multiples) {
		multiples = hasTickAmount ? 
			// Finer grained ticks when the tick amount is hard set, including
			// when alignTicks is true on multiple axes (#4580).
			[1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10] :

			// Else, let ticks fall on rounder numbers
			[1, 2, 2.5, 5, 10];


		// the allowDecimals option
		if (allowDecimals === false) {
			if (magnitude === 1) {
				multiples = H.grep(multiples, function (num) {
					return num % 1 === 0;
				});
			} else if (magnitude <= 0.1) {
				multiples = [1 / magnitude];
			}
		}
	}

	// normalize the interval to the nearest multiple
	for (i = 0; i < multiples.length; i++) {
		retInterval = multiples[i];
		// only allow tick amounts smaller than natural
		if (
			(
				hasTickAmount &&
				retInterval * magnitude >= interval
			) || 
			(
				!hasTickAmount &&
				(
					normalized <=
					(
						multiples[i] +
						(multiples[i + 1] || multiples[i])
					) / 2
				)
			)
		) {
			break;
		}
	}

	// Multiply back to the correct magnitude. Correct floats to appropriate 
	// precision (#6085).
	retInterval = H.correctFloat(
		retInterval * magnitude,
		-Math.round(Math.log(0.001) / Math.LN10)
	);
	
	return retInterval;
};


/**
 * Sort an object array and keep the order of equal items. The ECMAScript
 * standard does not specify the behaviour when items are equal.
 *
 * @function #stableSort
 * @memberOf Highcharts
 * @param {Array} arr - The array to sort.
 * @param {Function} sortFunction - The function to sort it with, like with 
 *        regular Array.prototype.sort.
 * 
 */
H.stableSort = function (arr, sortFunction) {
	var length = arr.length,
		sortValue,
		i;

	// Add index to each item
	for (i = 0; i < length; i++) {
		arr[i].safeI = i; // stable sort index
	}

	arr.sort(function (a, b) {
		sortValue = sortFunction(a, b);
		return sortValue === 0 ? a.safeI - b.safeI : sortValue;
	});

	// Remove index from items
	for (i = 0; i < length; i++) {
		delete arr[i].safeI; // stable sort index
	}
};

/**
 * 非递归实现的查询数组最小值方法。 
 *
 * 
 * 在 Chrome 中，当数组数量超过 150000 时使用 `Math.min`，会导致内存溢出问题。
 * 这个函数相对 `Math.min` 慢，但是更安全
 *
 * @function #arrayMin
 * @memberOf  Highcharts
 * @param {Array} data 数值数组。
 * @returns {Number} 数组中的最小值。
 */
H.arrayMin = function (data) {
	var i = data.length,
		min = data[0];

	while (i--) {
		if (data[i] < min) {
			min = data[i];
		}
	}
	return min;
};

/**
 * 非递归实现的查询数组最大值方法。
 * 
 * 在 Chrome 中，当数组数量超过 150000 时使用 `Math.nax`，会导致内存溢出问题。
 * 这个函数相对 `Math.max` 慢，但是更安全
 *
 *
 * @function #arrayMax
 * @memberOf  Highcharts
 * @param {Array} data - 数值数组。
 * @returns {Number} 数组中最大值。
 */
H.arrayMax = function (data) {
	var i = data.length,
		max = data[0];

	while (i--) {
		if (data[i] > max) {
			max = data[i];
		}
	}
	return max;
};

/**
 * Utility method that destroys any SVGElement instances that are properties on
 * the given object. It loops all properties and invokes destroy if there is a
 * destroy method. The property is then delete.
 *
 * @function #destroyObjectProperties
 * @memberOf Highcharts
 * @param {Object} obj - The object to destroy properties on.
 * @param {Object} [except] - Exception, do not destroy this property, only
 *    delete it.
 * 
 */
H.destroyObjectProperties = function (obj, except) {
	H.objectEach(obj, function (val, n) {
		// If the object is non-null and destroy is defined
		if (val && val !== except && val.destroy) {
			// Invoke the destroy
			val.destroy();
		}
		
		// Delete the property from the object.
		delete obj[n];
	});
};


/**
 * 删除 DOM 
 *
 * @function #discardElement
 * @memberOf Highcharts
 * @param {HTMLDOMElement} element - 需要删除的 DOM
 * 
 */
H.discardElement = function (element) {
	var garbageBin = H.garbageBin;
	// create a garbage bin element, not part of the DOM
	if (!garbageBin) {
		garbageBin = H.createElement('div');
	}

	// move the node and empty bin
	if (element) {
		garbageBin.appendChild(element);
	}
	garbageBin.innerHTML = '';
};

/**
 * Fix JS round off float errors.
 *
 * @function #correctFloat
 * @memberOf Highcharts
 * @param {Number} num - A float number to fix.
 * @param {Number} [prec=14] - The precision.
 * @returns {Number} The corrected float number.
 */
H.correctFloat = function (num, prec) {
	return parseFloat(
		num.toPrecision(prec || 14)
	);
};

/**
 * Set the global animation to either a given value, or fall back to the given
 * chart's animation option.
 *
 * @function #setAnimation
 * @memberOf Highcharts
 * @param {Boolean|Animation} animation - The animation object.
 * @param {Object} chart - The chart instance.
 * 
 * @todo This function always relates to a chart, and sets a property on the
 *        renderer, so it should be moved to the SVGRenderer.
 */
H.setAnimation = function (animation, chart) {
	chart.renderer.globalAnimation = H.pick(
		animation,
		chart.options.chart.animation,
		true
	);
};

/**
 * Get the animation in object form, where a disabled animation is always
 * returned as `{ duration: 0 }`.
 *
 * @function #animObject
 * @memberOf Highcharts
 * @param {Boolean|AnimationOptions} animation - An animation setting. Can be an
 *        object with duration, complete and easing properties, or a boolean to
 *        enable or disable.
 * @returns {AnimationOptions} An object with at least a duration property.
 */
H.animObject = function (animation) {
	return H.isObject(animation) ?
		H.merge(animation) :
		{ duration: animation ? 500 : 0 };
};

/**
 * 常用的时间单位
 */
H.timeUnits = {
	millisecond: 1,
	second: 1000,
	minute: 60000,
	hour: 3600000,
	day: 24 * 3600000,
	week: 7 * 24 * 3600000,
	month: 28 * 24 * 3600000,
	year: 364 * 24 * 3600000
};

/**
 * 数值格式化
 * 
 * @function #numberFormat
 * @memberOf Highcharts
 * @param {Number} number - 需要格式化的数值。
 * @param {Number} decimals - 需要保留的小数位。-1 表示保留全部位数
 * @param {String} [decimalPoint] - 小数点符号，默认是取 `lang.decimalPoint` 值（默认是点号）。
 * @param {String} [thousandsSep] - 千分号符号，默认是取 `lang.thousandsSep` 值（默认是空格）。
 * @returns {String} 格式化后的字符串.
 *
 * @sample highcharts/members/highcharts-numberformat/ Custom number format
 */
H.numberFormat = function (number, decimals, decimalPoint, thousandsSep) {
	number = +number || 0;
	decimals = +decimals;

	var lang = H.defaultOptions.lang,
		origDec = (number.toString().split('.')[1] || '').split('e')[0].length,
		strinteger,
		thousands,
		ret,
		roundedNumber,
		exponent = number.toString().split('e'),
		fractionDigits;

	if (decimals === -1) {
		// Preserve decimals. Not huge numbers (#3793).
		decimals = Math.min(origDec, 20);
	} else if (!H.isNumber(decimals)) {
		decimals = 2;
	} else if (decimals && exponent[1] && exponent[1] < 0) {
		// Expose decimals from exponential notation (#7042)
		fractionDigits = decimals + +exponent[1];
		if (fractionDigits >= 0) {
			// remove too small part of the number while keeping the notation
			exponent[0] = (+exponent[0]).toExponential(fractionDigits)
				.split('e')[0];
			decimals = fractionDigits;
		} else {
			// fractionDigits < 0
			exponent[0] = exponent[0].split('.')[0] || 0;

			if (decimals < 20) {
				// use number instead of exponential notation (#7405)
				number = (exponent[0] * Math.pow(10, exponent[1]))
					.toFixed(decimals);
			} else {
				// or zero
				number = 0;
			}
			exponent[1] = 0;
		}
	}

	// Add another decimal to avoid rounding errors of float numbers. (#4573)
	// Then use toFixed to handle rounding.
	roundedNumber = (
		Math.abs(exponent[1] ? exponent[0] : number) +
		Math.pow(10, -Math.max(decimals, origDec) - 1)
	).toFixed(decimals);

	// A string containing the positive integer component of the number
	strinteger = String(H.pInt(roundedNumber));

	// Leftover after grouping into thousands. Can be 0, 1 or 3.
	thousands = strinteger.length > 3 ? strinteger.length % 3 : 0;

	// Language
	decimalPoint = H.pick(decimalPoint, lang.decimalPoint);
	thousandsSep = H.pick(thousandsSep, lang.thousandsSep);

	// Start building the return
	ret = number < 0 ? '-' : '';

	// Add the leftover after grouping into thousands. For example, in the
	// number 42 000 000, this line adds 42.
	ret += thousands ? strinteger.substr(0, thousands) + thousandsSep : '';

	// Add the remaining thousands groups, joined by the thousands separator
	ret += strinteger
		.substr(thousands)
		.replace(/(\d{3})(?=\d)/g, '$1' + thousandsSep);

	// Add the decimal point and the decimal component
	if (decimals) {
		// Get the decimal component
		ret += decimalPoint + roundedNumber.slice(-decimals);
	}

	if (exponent[1] && +ret !== 0) {
		ret += 'e' + exponent[1];
	}

	return ret;
};

/**
 * 缓动函数定义
 * @ignore
 * @param   {Number} pos Current position, ranging from 0 to 1.
 */
Math.easeInOutSine = function (pos) {
	return -0.5 * (Math.cos(Math.PI * pos) - 1);
};

/**
 * Get the computed CSS value for given element and property, only for numerical
 * properties. For width and height, the dimension of the inner box (excluding
 * padding) is returned. Used for fitting the chart within the container.
 *
 * @function #getStyle
 * @memberOf Highcharts
 * @param {HTMLDOMElement} el - A HTML element.
 * @param {String} prop - The property name.
 * @param {Boolean} [toInt=true] - Parse to integer.
 * @returns {Number} - The numeric value.
 */
H.getStyle = function (el, prop, toInt) {

	var style;

	// For width and height, return the actual inner pixel size (#4913)
	if (prop === 'width') {
		return Math.min(el.offsetWidth, el.scrollWidth) -
			H.getStyle(el, 'padding-left') -
			H.getStyle(el, 'padding-right');
	} else if (prop === 'height') {
		return Math.min(el.offsetHeight, el.scrollHeight) -
			H.getStyle(el, 'padding-top') -
			H.getStyle(el, 'padding-bottom');
	}

	if (!win.getComputedStyle) {
		// SVG not supported, forgot to load oldie.js?
		H.error(27, true);
	}

	// Otherwise, get the computed style
	style = win.getComputedStyle(el, undefined);
	if (style) {
		style = style.getPropertyValue(prop);
		if (H.pick(toInt, prop !== 'opacity')) {
			style = H.pInt(style);
		}
	}
	return style;
};

/**
 * 查找给定的内容是否在数组中
 *
 * @function #inArray
 * @memberOf Highcharts
 * @param {*} item - The item to search for.
 * @param {arr} arr - The array or node collection to search in.
 * @returns {Number} - The index within the array, or -1 if not found.
 */
H.inArray = function (item, arr) {
	return (H.indexOfPolyfill || Array.prototype.indexOf).call(arr, item);
};

/**
 * 数组过滤
 *
 * @function #grep
 * @memberOf Highcharts
 * @param {Array} arr - The array to filter.
 * @param {Function} callback - The callback function. The function receives the
 *        item as the first argument. Return `true` if the item is to be
 *        preserved.
 * @returns {Array} - A new, filtered array.
 */
H.grep = function (arr, callback) {
	return (H.filterPolyfill || Array.prototype.filter).call(arr, callback);
};

/**
 * 查找，返回数组中满足条件函数的第一个元素
 *
 * @function #find
 * @memberOf Highcharts
 * @param {Array} arr - 目标数组.
 * @param {Function} callback - 条件函数， 该函数的第一个参数是数组的元素，当返回 `true` 表示满足条件。
 * @returns {Mixed} - 满足条件的内容。
 */
H.find = Array.prototype.find ?
	function (arr, callback) {
		return arr.find(callback);
	} :
	// Legacy implementation. PhantomJS, IE <= 11 etc. #7223.
	function (arr, fn) {
		var i,
			length = arr.length;

		for (i = 0; i < length; i++) {
			if (fn(arr[i], i)) {
				return arr[i];
			}
		}
	};

/**
 * 对数组进行 map 操作
 *
 * @function #map
 * @memberOf Highcharts
 * @param {Array} arr - The array to map.
 * @param {Function} fn - The callback function. Return the new value for the 
 *        new array.
 * @returns {Array} - A new array item with modified items.
 */
H.map = function (arr, fn) {
	var results = [],
		i = 0,
		len = arr.length;

	for (; i < len; i++) {
		results[i] = fn.call(arr[i], arr[i], i, arr);
	}

	return results;
};

/**
 * 返回包含目标对象属性的数组
 *
 * @function #keys
 * @memberOf highcharts
 * @param {Object} obj - The object of which the properties are to be returned.
 * @returns {Array} - An array of strings that represents all the properties.
 */
H.keys = function (obj) {
	return (H.keysPolyfill || Object.keys).call(undefined, obj);
};

/**
 * Reduce an array to a single value.
 *
 * @function #reduce
 * @memberOf Highcharts
 * @param {Array} arr - The array to reduce.
 * @param {Function} fn - The callback function. Return the reduced value. 
 *  Receives 4 arguments: Accumulated/reduced value, current value, current 
 *  array index, and the array.
 * @param {Mixed} initialValue - The initial value of the accumulator.
 * @returns {Mixed} - The reduced value.
 */
H.reduce = function (arr, func, initialValue) {
	return (H.reducePolyfill || Array.prototype.reduce).call(
		arr,
		func,
		initialValue
	);
};

/**
 * 获取元素的偏移位置， 可以修正 `overflow: auto`
 *
 * @function #offset
 * @memberOf Highcharts
 * @param {HTMLDOMElement} el - The HTML element.
 * @returns {Object} An object containing `left` and `top` properties for the
 * position in the page.
 */
H.offset = function (el) {
	var docElem = doc.documentElement,
		box = el.parentElement ? // IE11 throws Unspecified error in test suite
			el.getBoundingClientRect() :
			{ top: 0, left: 0 };

	return {
		top: box.top  + (win.pageYOffset || docElem.scrollTop) -
			(docElem.clientTop  || 0),
		left: box.left + (win.pageXOffset || docElem.scrollLeft) -
			(docElem.clientLeft || 0)
	};
};

/**
 * 停止正在运行动画
 *
 * @todo A possible extension to this would be to stop a single property, when
 * we want to continue animating others. Then assign the prop to the timer
 * in the Fx.run method, and check for the prop here. This would be an
 * improvement in all cases where we stop the animation from .attr. Instead of
 * stopping everything, we can just stop the actual attributes we're setting.
 *
 * @function #stop
 * @memberOf Highcharts
 * @param {SVGElement} el - The SVGElement to stop animation on.
 * @param {string} [prop] - The property to stop animating. If given, the stop
 *    method will stop a single property from animating, while others continue.
 * 
 */
H.stop = function (el, prop) {

	var i = H.timers.length;

	// Remove timers related to this element (#4519)
	while (i--) {
		if (H.timers[i].elem === el && (!prop || prop === H.timers[i].prop)) {
			H.timers[i].stopped = true; // #4667
		}
	}
};

/**
 * 数组遍历
 *
 * @function #each
 * @memberOf Highcharts
 * @param {Array} arr - 需要遍历的数组
 * @param {Function} fn - 遍历函数，函数中传递如下几个参数：
 * * item - 数组项
 * * index - 下标
 * * arr - 当前数组
 * @param {Object} [ctx] The context.
 */
H.each = function (arr, fn, ctx) { // modern browsers
	return (H.forEachPolyfill || Array.prototype.forEach).call(arr, fn, ctx);
};

/**
 * 对象遍历
 *
 * @function #objectEach
 * @memberOf Highcharts
 * @param  {Object}   obj - 需要遍历的对象。
 * @param  {Function} fn  - 遍历函数，函数中传递如下几个参数：
 * * value - 属性值
 * * key - 属性 key
 * * obj - 当前对象
 * @param  {Object}   ctx The context
 */
H.objectEach = function (obj, fn, ctx) {
	for (var key in obj) {
		if (obj.hasOwnProperty(key)) {
			fn.call(ctx, obj[key], key, obj);
		}
	}
};

/**
 * 添加事件
 *
 * @function #addEvent
 * @memberOf Highcharts
 * @param {Object} el - 需要添加事件的 DOM，可以是 
 *        {@link HTMLDOMElement}、 {@link SVGElement} 或其他对象。
 * @param {String} type - 事件类型.
 * @param {Function} fn - 事件触发时执行的回调函数
 * @returns {Function} 用于删除事件的回调函数
 */
H.addEvent = function (el, type, fn) {

	var events,
		itemEvents,
		addEventListener = el.addEventListener || H.addEventListenerPolyfill;

	// If events are previously set directly on the prototype, pick them up 
	// and copy them over to the instance. Otherwise instance handlers would
	// be set on the prototype and apply to multiple charts in the page.
	if (
		el.hcEvents &&
		// IE8, window and document don't have hasOwnProperty
		!Object.prototype.hasOwnProperty.call(el, 'hcEvents')
	) {
		itemEvents = {};
		H.objectEach(el.hcEvents, function (handlers, eventType) {
			itemEvents[eventType] = handlers.slice(0);
		});
		el.hcEvents = itemEvents;
	}

	events = el.hcEvents = el.hcEvents || {};

	// Handle DOM events
	if (addEventListener) {
		addEventListener.call(el, type, fn, false);
	}

	if (!events[type]) {
		events[type] = [];
	}

	events[type].push(fn);

	// Return a function that can be called to remove this event.
	return function () {
		H.removeEvent(el, type, fn);
	};
};

/**
 * 删除事件（删除通过 {@link Highcharts#addEvent} 方法增加的事件）
 *
 * @function #removeEvent
 * @memberOf Highcharts
 * @param {Object} el - DOM.
 * @param {String} [type] - 需要删除的事件类型，如果值是 undefined，则会把该 DOM 上的所有事件都删除
 * @param {Function} [fn] - The specific callback to remove. If undefined, all
 *        events that match the element and optionally the type are removed.
 *  
 */
H.removeEvent = function (el, type, fn) {
	
	var events,
		hcEvents = el.hcEvents,
		index;

	function removeOneEvent(type, fn) {
		var removeEventListener =
			el.removeEventListener || H.removeEventListenerPolyfill;
		
		if (removeEventListener) {
			removeEventListener.call(el, type, fn, false);
		}
	}

	function removeAllEvents() {
		var types,
			len;

		if (!el.nodeName) {
			return; // break on non-DOM events
		}

		if (type) {
			types = {};
			types[type] = true;
		} else {
			types = hcEvents;
		}

		H.objectEach(types, function (val, n) {
			if (hcEvents[n]) {
				len = hcEvents[n].length;
				while (len--) {
					removeOneEvent(n, hcEvents[n][len]);
				}
			}
		});
	}

	if (hcEvents) {
		if (type) {
			events = hcEvents[type] || [];
			if (fn) {
				index = H.inArray(fn, events);
				if (index > -1) {
					events.splice(index, 1);
					hcEvents[type] = events;
				}
				removeOneEvent(type, fn);

			} else {
				removeAllEvents();
				hcEvents[type] = [];
			}
		} else {
			removeAllEvents();
			el.hcEvents = {};
		}
	}
};

/**
 * 触发事件（触发的事件是通过  {@link Highcharts#addEvent} 注册的）。
 *
 * @function #fireEvent
 * @memberOf Highcharts
 * @param {Object} el - 触发事件的对象（DOM），可以是
 *        {@link HTMLDOMElement}、 {@link SVGElement} 或其他类型的 DOM。
 * @param {String} type - 事件类型。
 * @param {Object} [eventArguments] - 自定义的事件参数，会传递给事件处理函数
 * @param {Function} [defaultFunction] - 默认的事件响应函数（注意在其他事件监听器返回 false 时不再执行）
 * 
 */
H.fireEvent = function (el, type, eventArguments, defaultFunction) {
	var e,
		hcEvents = el.hcEvents,
		events,
		len,
		i,
		fn;

	eventArguments = eventArguments || {};

	if (doc.createEvent && (el.dispatchEvent || el.fireEvent)) {
		e = doc.createEvent('Events');
		e.initEvent(type, true, true);
		
		H.extend(e, eventArguments);

		if (el.dispatchEvent) {
			el.dispatchEvent(e);
		} else {
			el.fireEvent(type, e);
		}

	} else if (hcEvents) {
		
		events = hcEvents[type] || [];
		len = events.length;

		if (!eventArguments.target) { // We're running a custom event

			H.extend(eventArguments, {
				// Attach a simple preventDefault function to skip default
				// handler if called. The built-in defaultPrevented property is
				// not overwritable (#5112)
				preventDefault: function () {
					eventArguments.defaultPrevented = true;
				},
				// Setting target to native events fails with clicking the
				// zoom-out button in Chrome.
				target: el,
				// If the type is not set, we're running a custom event (#2297).
				// If it is set, we're running a browser event, and setting it
				// will cause en error in IE8 (#2465).		
				type: type
			});
		}

		
		for (i = 0; i < len; i++) {
			fn = events[i];

			// If the event handler return false, prevent the default handler
			// from executing
			if (fn && fn.call(el, eventArguments) === false) {
				eventArguments.preventDefault();
			}
		}
	}
			
	// Run the default if not prevented
	if (defaultFunction && !eventArguments.defaultPrevented) {
		defaultFunction(eventArguments);
	}
};

/**
 * An animation configuration. Animation configurations can also be defined as
 * booleans, where `false` turns off animation and `true` defaults to a duration
 * of 500ms.
 * @typedef {Object} AnimationOptions
 * @property {Number} duration - The animation duration in milliseconds.
 * @property {String} [easing] - The name of an easing function as defined on
 *     the `Math` object.
 * @property {Function} [complete] - A callback function to exectute when the
 *     animation finishes.
 * @property {Function} [step] - A callback function to execute on each step of
 *     each attribute or CSS property that's being animated. The first argument
 *     contains information about the animation and progress.
 */


/**
 * The global animate method, which uses Fx to create individual animators.
 *
 * @function #animate
 * @memberOf Highcharts
 * @param {HTMLDOMElement|SVGElement} el - The element to animate.
 * @param {Object} params - An object containing key-value pairs of the
 *        properties to animate. Supports numeric as pixel-based CSS properties
 *        for HTML objects and attributes for SVGElements.
 * @param {AnimationOptions} [opt] - Animation options.
 */
H.animate = function (el, params, opt) {
	var start,
		unit = '',
		end,
		fx,
		args;

	if (!H.isObject(opt)) { // Number or undefined/null
		args = arguments;
		opt = {
			duration: args[2],
			easing: args[3],
			complete: args[4]
		};
	}
	if (!H.isNumber(opt.duration)) {
		opt.duration = 400;
	}
	opt.easing = typeof opt.easing === 'function' ?
		opt.easing :
		(Math[opt.easing] || Math.easeInOutSine);
	opt.curAnim = H.merge(params);

	H.objectEach(params, function (val, prop) {
		// Stop current running animation of this property
		H.stop(el, prop);
		
		fx = new H.Fx(el, opt, prop);
		end = null;
		
		if (prop === 'd') {
			fx.paths = fx.initPath(
				el,
				el.d,
				params.d
			);
			fx.toD = params.d;
			start = 0;
			end = 1;
		} else if (el.attr) {
			start = el.attr(prop);
		} else {
			start = parseFloat(H.getStyle(el, prop)) || 0;
			if (prop !== 'opacity') {
				unit = 'px';
			}
		}
		
		if (!end) {
			end = val;
		}
		if (end && end.match && end.match('px')) {
			end = end.replace(/px/g, ''); // #4351
		}
		fx.run(start, end, unit);
	});
};

/**
 * 创建新数据列类型的工厂方法
 *
 * @function #seriesType
 * @memberOf Highcharts
 *
 * @param {String} type - 数据列名字
 * @param {String} parent - 需要继承的数据类类型名字。可以使用 `line` 来继承基础数据列类型（ {@link Series} ）。
 * @param {Object} options - 新的配置，会和父级的数据列中的配置进行合并操作。
 * @param {Object} props - The properties (functions and primitives) to set on
 *        the new prototype.
 * @param {Object} [pointProps] - Members for a series-specific extension of the
 *        {@link Point} prototype if needed.
 * @returns {*} - The newly created prototype as extended from {@link Series}
 * or its derivatives.
 */
// docs: add to API + extending Highcharts
H.seriesType = function (type, parent, options, props, pointProps) {
	var defaultOptions = H.getOptions(),
		seriesTypes = H.seriesTypes;

	// Merge the options
	defaultOptions.plotOptions[type] = H.merge(
		defaultOptions.plotOptions[parent], 
		options
	);
	
	// Create the class
	seriesTypes[type] = H.extendClass(seriesTypes[parent] ||
		function () {}, props);
	seriesTypes[type].prototype.type = type;

	// Create the point class if needed
	if (pointProps) {
		seriesTypes[type].prototype.pointClass =
			H.extendClass(H.Point, pointProps);
	}

	return seriesTypes[type];
};

/**
 * 获取唯一的字符串，用于内部元素的 id 或指针赋值。该字符串的形式是 ‘highhcarts-’ + 随机 Hash 值（7位） + 计数
 * @function #uniqueKey
 * @memberOf Highcharts
 * @return {string} 字符串
 * @example
 * var id = H.uniqueKey(); // => 'highcharts-x45f6hp-0'
 */
H.uniqueKey = (function () {
	
	var uniqueKeyHash = Math.random().toString(36).substring(2, 9),
		idCounter = 0;

	return function () {
		return 'highcharts-' + uniqueKeyHash + '-' + idCounter++;
	};
}());

/**
 * 将 Highcharts 注册为 jQuery 插件，用于提供 jQuery 插件形式的初始化方法，即
 *
 * 	$(el).highcharts(options) 的形式
 * 
 */
if (win.jQuery) {
	win.jQuery.fn.highcharts = function () {
		var args = [].slice.call(arguments);

		if (this[0]) { // this[0] is the renderTo div

			// Create the chart
			if (args[0]) {
				new H[ // eslint-disable-line no-new
					// Constructor defaults to Chart
					H.isString(args[0]) ? args.shift() : 'Chart'
				](this[0], args[0], args[1]);
				return this;
			}

			// When called without parameters or with the return argument,
			// return an existing chart
			return charts[H.attr(this[0], 'data-highcharts-chart')];
		}
	};
}
