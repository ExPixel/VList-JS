module VList {
	const enum VListBufferPosition {
		ABOVE, BELOW, INSIDE
	}

	interface VListOptions {
		container: HTMLElement | string;
		elementHeight: number;
		render?: (index: number, oldElement: HTMLElement, oldElementIndex: number) => HTMLElement;
		template?: string;
		templateRender?: (index: number, template: any) => void;
		onCreateElement?: (index: number, element: Element) => void;
	}

	class VListData {
		container: HTMLElement;
		elementHeight: number;
		render?: (index: number, oldElement: HTMLElement, oldElementIndex: number) => HTMLElement;
		template?: string;
		templateRender?: (index: number, template: any) => void;
		onCreateElement?: (index: number, element: Element) => void;
	}

	class VListBuffer {
		// Name
		name: string;
		
		/**
		 * The last start index this buffer was rendered at.
		 */
		prevRenderStartIndex: number;

		/**
		 * The first item that this buffer is rendering.
		 */
		renderStartIndex: number;

		/**
		 * The number of items that this buffer is rendering.
		 */
		renderLength: number;

		/**
		 * The number of elements from this buffer currently being displayed.
		 */
		renderedElements: number = 0;

		/**
		 * Container for the items.
		 */
		container: HTMLDivElement;

		/**
		 * The elements that this buffer is in control of.
		 */
		elements: HTMLElement[] = [];

		/**
		 * Maps elements to template objects.
		 */
		elementTemplates: any[];

		/**
		 * Y position of the container in the viewport.
		 */
		y: number;

		constructor(public off: number = 0) {
			this.container = document.createElement('div');
			this.container.style.margin = "0";
			this.container.style.padding = "0";
		}

		public moveTo(y: number) {
			this.y = y;
			this.container.style.transform = `translateY(${y - this.off}px)`;
		}

		public setRenderLength(l: number) {
			this.renderLength = l;
			if (this.elements.length > l) {
				let idx = l, len = this.elements.length;
				for(idx; idx < len; idx++) {
					let element = this.elements[idx];
					if (element) {
						element.remove()
					}
				}
				this.elements.splice(l, this.elements.length - l);

				if (this.elementTemplates && this.elementTemplates.length > this.elements.length) {
					this.elementTemplates.splice(this.elements.length, this.elementTemplates.length - this.elements.length)
				}
			}
		}
	}

	class VList {
		private buffer0: VListBuffer = new VListBuffer();
		private buffer1: VListBuffer = new VListBuffer();
		private _length: number = 0;
		private bufferHeight: number = 0;
		private data: VListData = new VListData();
		private templateMode: boolean;
		private templateBindingInfo: any;
		private elementCreator = document.createElement('div');

		constructor(options: VListOptions) {
			console.log(options);
			if (options.templateRender && !options.template)
				throw Error("A template string must be provided when also providing a template render function.");
			if (options.templateRender && options.render)
				throw Error("A normal render function cannot be passed alongside a template render function.");
			if (options.template && !options.templateRender)
				throw Error("A template render function must be provided when also providing a template string.");

			if (typeof options.container === "string") {
				this.data.container = document.querySelector(options.container as string) as HTMLElement;
			} else {
				this.data.container = options.container as HTMLElement;
			}
			this.data.elementHeight = options.elementHeight;
			this.data.render = options.render;
			this.data.template = options.template;
			this.data.templateRender = options.templateRender;
			this.data.onCreateElement = options.onCreateElement;
			if (this.data.template) {
				this.buffer0.elementTemplates = [];
				this.buffer1.elementTemplates = [];
				this.templateMode = true;
				this.compileTemplate();
			}

			this.buffer0.name = "buf0";
			this.buffer1.name = "buf1";

			this.viewportSizeChanged();
			this.setContainerHeight();

			this.data.container.parentElement.addEventListener('scroll', () => {
				this.scrollPositionChanged();
			});

			this.data.container.appendChild(this.buffer0.container);
			this.data.container.appendChild(this.buffer1.container);
			this.buffer1.off = this.bufferHeight;
		}

		setContainerHeight() {
			this.data.container.style.height = Math.ceil(this.data.elementHeight * this._length) + "px";
		}

		public viewportSizeChanged() {
			let style = window.getComputedStyle(this.data.container.parentElement, null);
			let height = parseInt(style.getPropertyValue('height'));
			let renderLength = Math.ceil(height / this.data.elementHeight) * 2;
			this.buffer0.setRenderLength(renderLength);
			this.buffer1.setRenderLength(renderLength);
			this.bufferHeight = height * 2;
			this.render(true);
		}

		scrollPositionChanged() {
			this.render(false);
		}

		private compileTemplate() {
			let _createNode = document.createElement('div');
			_createNode.innerHTML = this.data.template;
			if (_createNode.firstElementChild && _createNode.firstElementChild.nextElementSibling) {
				throw Error("Templates must have a single top level element.");
			}
			this.templateBindingInfo = {};

			let process = (node: Element, parents: number[], current: number) => {
				let attr = node.getAttribute('vlist-name');
				if (attr) {
					let temp = parents.slice(0);
					temp.push(current);
					this.templateBindingInfo[attr] = temp;
				}
			};
			process(_createNode, [], 0);

			let visit: (node: Node, parents: number[]) => void;
			visit = (node: Element, parents: number[]) => {
				let siblingIdx = 0;
				do {
					process(node as Element, parents, siblingIdx);
					if (node.firstElementChild) {
						parents.push(siblingIdx);
						visit(node.firstElementChild, parents);
						parents.pop();
					}
					siblingIdx++;
					node = node.nextElementSibling;
				} while(node);
			}

			visit(_createNode.firstElementChild, []);
		}

		/**
		 * Call this method after you have inserted items into the dataset.
		 * @param {number} startIndex The index at which the insertion was made.
		 * @param {number} length The number of items inserted into the dataset.
		 */
		public inserted(startIndex: number, length: number=1) {
			let rel = this.indexPositionRelativeToBuffers(startIndex, length);
			this.length += length;
			switch(rel) {
				case VListBufferPosition.BELOW: break;
				case VListBufferPosition.ABOVE:
					this.shiftBufferPositions(length * this.data.elementHeight);
					break;
				default:
					this.render(true);
					break;
			}
		}

		// #TODO optimize this so it doesn't do a full render maybe?
		//       those can be expensive.
		public changed(startIndex: number, length: number) {
			length = Math.min(this.length, length);
			let rel = this.indexPositionRelativeToBuffers(startIndex, length);
			if (rel === VListBufferPosition.INSIDE) {
				this.render(true);
			}
		}

		public removed(startIndex: number, length: number=1) {
			length = Math.min(this.length, length);
			let rel = this.indexPositionRelativeToBuffers(startIndex, length);
			this.length -= length;
			switch(rel) {
				case VListBufferPosition.BELOW: break;
				case VListBufferPosition.ABOVE:
					this.shiftBufferPositions(-1 * length * this.data.elementHeight);
					break;
				default:
					this.render(true);
					break;
			}
		}

		private shiftBufferPositions(shiftBy: number) {
			this.buffer0.moveTo(this.buffer0.y + shiftBy);
			this.buffer1.moveTo(this.buffer1.y + shiftBy);
		}

		private indexPositionRelativeToBuffers(index: number, length: number=index) {
			let end = index + (length - 1);
			let bbegin = Math.min(this.buffer0.renderStartIndex, this.buffer1.renderStartIndex);
			if (end < bbegin) { return VListBufferPosition.ABOVE; }
			let bend = Math.min(this.buffer0.renderStartIndex + this.buffer0.renderLength, 
				this.buffer1.renderStartIndex) + this.buffer1.renderLength;
			if (index > bend) { return VListBufferPosition.BELOW; }
			return VListBufferPosition.INSIDE;
		}

		public render(forceRefresh: boolean) {
			let pos = this.data.container.parentElement.scrollTop;
			if (pos > this.bufferHeight && (this.length * this.data.elementHeight > this.bufferHeight)) {
				pos = Math.min(pos, this.length * this.data.elementHeight - this.bufferHeight);
			}
			let displayBuffer = Math.floor(pos / this.bufferHeight) % 2; // The current buffer that we are in.
			let bufferStartPosition = pos - (pos % this.bufferHeight);
			let bufferStartElement = Math.floor(bufferStartPosition / this.data.elementHeight);

			let cb: VListBuffer; // current buffer.
			let ob: VListBuffer; // other buffer.
			if (displayBuffer == 0) { cb = this.buffer0; ob = this.buffer1; }
			else { cb = this.buffer1; ob = this.buffer0; }

			if (cb.renderStartIndex !== bufferStartElement || forceRefresh) {
				cb.prevRenderStartIndex = cb.renderStartIndex;
				cb.renderStartIndex = bufferStartElement;
				cb.moveTo(bufferStartPosition);
				this.renderBuffer(cb);
			}

			let a: string;
			if (pos > (bufferStartPosition + this.bufferHeight / 2)) { // Below.
				let _s = Math.min(this.length - 1, cb.renderStartIndex + cb.renderLength)
				if (ob.renderStartIndex !== _s || forceRefresh) {
					ob.prevRenderStartIndex = ob.renderStartIndex;
					ob.renderStartIndex = _s;
					ob.moveTo(cb.y + this.bufferHeight);
					this.renderBuffer(ob)
				}
			} else { // Above
				let _s = Math.max(0, cb.renderStartIndex - cb.renderLength);
				if (ob.renderStartIndex !== _s || forceRefresh) {
					ob.prevRenderStartIndex = ob.renderStartIndex;
					ob.renderStartIndex = _s;
					ob.moveTo(cb.y - this.bufferHeight);
					this.renderBuffer(ob, cb.renderStartIndex);
				}
			}
		}

		private createTemplateElement() : any {
			this.elementCreator.innerHTML = "";
			this.elementCreator.innerHTML = this.data.template;
			let element = this.elementCreator.firstElementChild;
			let templateInfo: any = {};

			for (let key in this.templateBindingInfo) {
				let searchArr = this.templateBindingInfo[key];
				let node: Element = this.elementCreator;
				for (let curIdx = 0; curIdx < searchArr.length; curIdx++) {
					node = node.children[searchArr[curIdx]];
				}
				templateInfo[key] = node;
			}
			this.elementCreator.innerHTML = "";
			return {
				element,
				templateInfo
			}
		}

		private renderBuffer(buffer: VListBuffer, renderTo: number=Number.POSITIVE_INFINITY) {
			let r = 0, pidx = buffer.prevRenderStartIndex, idx = buffer.renderStartIndex, length = buffer.renderLength;
			buffer.container.innerHTML = ""; // clear it.
			for (; r < length && idx < this.length && idx < renderTo; r++, idx++, pidx++) {
				if (this.templateMode) {
					let el = buffer.elements[r];
					let info: any;
					if (el) {
						info = buffer.elementTemplates[r];
					} else {
						let elInfo = this.createTemplateElement();
						el = elInfo.element;
						info = elInfo.templateInfo;
						info["$root"] = el;
						buffer.elements[r] = el;
						buffer.elementTemplates[r] = info;
						if (this.data.onCreateElement) {
							this.data.onCreateElement(idx, el);
						}
					}
					this.data.templateRender(idx, info);
					buffer.container.appendChild(el);
				} else {
					let old = buffer.elements[r];
					let el = this.data.render(idx, old, pidx);
					if (old !== el) {this.data.onCreateElement(idx, el);}
					buffer.container.appendChild(el);
					buffer.elements[r] = el;
				}
			}
		}
		
		set length(v: number) { this._length = v; this.setContainerHeight() }
		get length(): number { return this._length; }
	}

	export function init(options: VListOptions) : VList {
		return new VList(options);
	}
}