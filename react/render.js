import { TEXT_ELEMENT } from "./constant";

let nextUnitOfWork = null;
requestIdleCallback(workLoop);

function workLoop(deadline) {
	let shouldYield = false;

	if (nextUnitOfWork && !shouldYield) {
		nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
		shouldYield = deadline.timeRemaining() < 1;
	}

	requestIdleCallback(workLoop);
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

	if (fiber.parent) {
		fiber.parent.dom.appendChild(fiber.dom);
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
	nextUnitOfWork = {
		dom: container,
		type: element.type,
		props: {
			children: [element],
		},
	};
}
