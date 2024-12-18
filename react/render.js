import { TEXT_ELEMENT } from "./constant";

let nextUnitOfWork = null; // 下一个工作单元
let wipRoot = null; // 正在工作的根节点
requestIdleCallback(workLoop);

function workLoop(deadline) {
	let shouldYield = false;

	if (nextUnitOfWork && !shouldYield) {
		nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
		shouldYield = deadline.timeRemaining() < 1;
	}

	// 如果我们在 performUnitOfWork 中每次都 appendChild 添加新节点
	// 在我们完成渲染整个树之前，浏览器可能会中断我们的操作，导致渲染不完整，用户看不到一个完整的页面
	// 因此，我们在完成了所有的工作单元后，再提交整个根节点到 DOM
	if (!nextUnitOfWork && wipRoot) {
		commitRoot();
	}

	requestIdleCallback(workLoop);
}

// 添加所有节点到DOM
function commitRoot() {
	commitWork(wipRoot.child);
	wipRoot = null;
}

// 递归地将所有节点添加到 DOM
function commitWork(fiber) {
	if (!fiber) return;

	const domParent = fiber.parent.dom;
	domParent.appendChild(fiber.dom);
	commitWork(fiber.child);
	commitWork(fiber.sibling);
}

// Fiber
// 当我们完成一个 Fiber 节点的渲染后，如果它有子节点 child，那么下一个工作单元就是这个 child
// 如果它没有子节点 child，那么它的兄弟节点 sibling 就是下一个工作单元
// 如果它既没有子节点 child，也没有兄弟节点 sibling，那么下一个工作单元是它父节点的兄弟节点 sibling
// 如果父节点也没有兄弟节点 sibling，那么我们就继续向上遍历，直到找到有 sibling 的节点，或者到达根节点
function performUnitOfWork(fiber) {
	// add dom node
	if (!fiber.dom) {
		fiber.dom = createDom(fiber);
	}

	//  create new fibers
	const elements = fiber.props.children;
	let index = 0;
	let prevSibling = null;

	while (index < elements.length) {
		const element = elements[index];

		const newFiber = {
			type: element.type,
			props: element.props,
			parent: fiber,
			dom: null,
		};

		if (index === 0) {
			fiber.child = newFiber;
		} else {
			prevSibling.sibling = newFiber;
		}

		prevSibling = newFiber;
		index++;
	}

	// return next unit of work
	if (fiber.child) {
		return fiber.child;
	}

	let nextFiber = fiber;
	while (nextFiber) {
		if (nextFiber.sibling) {
			return nextFiber.sibling;
		}

		nextFiber = nextFiber.parent;
	}
}

function createDom(fiber) {
	const element =
		fiber.type === TEXT_ELEMENT
			? document.createTextNode("")
			: document.createElement(fiber.type);

	const isProperty = (key) => key !== "children";

	Object.keys(fiber.props)
		.filter(isProperty)
		.forEach((prop) => {
			element[prop] = fiber.props[prop];
		});

	return element;
}

export function render(element, container) {
	wipRoot = {
		dom: container,
		type: element.type,
		props: {
			children: [element],
		},
	};

	nextUnitOfWork = wipRoot;
}
