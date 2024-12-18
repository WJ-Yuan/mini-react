import { TEXT_ELEMENT } from "./constant";

let nextUnitOfWork = null;
requestIdleCallback(workLoop);

function workLoop(deadline) {
	let shouldYield = false;

	if (nextUnitOfWork && !shouldYield) {
		nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
		shouldYield = deadline.timeRemain() < 1;
	}

	requestIdleCallback(workLoop);
}

function performUnitOfWork(nextUnitOfWork) {}

export function render(element, container) {
	const dom =
		element.type === TEXT_ELEMENT
			? document.createTextNode("")
			: document.createElement(element.type);

	const isProperty = (key) => key !== "children";

	Object.keys(element.props)
		.filter(isProperty)
		.forEach((prop) => {
			dom[prop] = element.props[prop];
		});

	element.props.children.forEach((child) => {
		render(child, dom);
	});

	container.appendChild(dom);
}
