import { EFFECT_TAGS, TEXT_ELEMENT } from "./constant";

let nextUnitOfWork = null; // 下一个工作单元
let wipRoot = null; // 正在工作的根节点
let currentRoot = null; // 当前根节点，用于和上一次的根节点进行比较
let deletions = null; // 要删除的节点数组

requestIdleCallback(workLoop);

function workLoop(deadline) {
	let shouldYield = false;

	while (nextUnitOfWork && !shouldYield) {
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
	deletions.forEach(commitWork);
	commitWork(wipRoot.child);
	currentRoot = wipRoot; // 保存当前根节点，用于下一次比较
	wipRoot = null;
}

// 递归地将所有节点添加到 DOM
function commitWork(fiber) {
	if (!fiber) return;

	// 获取父级 DOM 节点
	let domParentFiber = fiber.parent;
	while (!domParentFiber.dom) {
		domParentFiber = domParentFiber.parent;
	}
	const domParent = domParentFiber.dom;

	if (fiber.effectTag === EFFECT_TAGS.PLACEMENT && fiber.dom) {
		// 新增节点
		domParent.appendChild(fiber.dom);
	} else if (fiber.effectTag === EFFECT_TAGS.UPDATE && fiber.dom) {
		// 更新节点
		updateDom(fiber.dom, fiber.alternate.props, fiber.props);
	} else if (fiber.effectTag === EFFECT_TAGS.DELETION) {
		// 删除节点
		commitDeletion(fiber, domParent);
	}

	commitWork(fiber.child);
	commitWork(fiber.sibling);
}

function updateDom(dom, prevProps, nextProps) {
	const isEvent = (key) => key.startsWith("on");
	const isProperty = (key) => key !== "children" && !isEvent(key);
	const isNew = (prev, next) => (key) => prev[key] !== next[key];
	const isGone = (_, next) => (key) => !(key in next);

	// remove old event listeners
	Object.keys(prevProps)
		.filter(isEvent)
		.filter((name) => !(name in nextProps) || isNew(prevProps, nextProps)(name))
		.forEach((name) => {
			const eventType = name.toLowerCase().substring(2);
			dom.removeEventListener(eventType, prevProps[name]);
		});

	// Remove old properties
	Object.keys(prevProps)
		.filter(isProperty)
		.filter(isGone(prevProps, nextProps))
		.forEach((name) => {
			dom[name] = "";
		});

	// add new event listeners
	Object.keys(nextProps)
		.filter(isEvent)
		.filter((name) => isNew(prevProps, nextProps)(name))
		.forEach((name) => {
			const eventType = name.toLowerCase().substring(2);
			dom.addEventListener(eventType, nextProps[name]);
		});

	// add new properties
	Object.keys(nextProps)
		.filter(isProperty)
		.filter(isNew(prevProps, nextProps))
		.forEach((name) => {
			dom[name] = nextProps[name];
		});
}

function commitDeletion(fiber, domParent) {
	if (fiber.dom) {
		domParent.removeChild(fiber.dom);
	} else {
		commitDeletion(fiber.child, domParent);
	}
}

function performUnitOfWork(fiber) {
	// 判断是否是函数组件
	const isFunctionComponent = fiber.type instanceof Function;
	if (isFunctionComponent) {
		updateFunctionComponent(fiber);
	} else {
		updateHostComponent(fiber);
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

function updateFunctionComponent(fiber) {
	wipFiber = fiber;
	hookIndex = 0;
	wipFiber.hooks = [];

	// 1. 调用函数组件，获取新的元素
	const children = [fiber.type(fiber.props)];
	// 2. 为当前节点创建子节点的 fiber
	reconcileChildren(fiber, children);
}

let wipFiber = null; // 正在工作的 fiber
let hookIndex = null;

export function useState(initial) {
	const oldHook = wipFiber?.alternate?.hooks?.[hookIndex];
	const hook = {
		state: oldHook ? oldHook.state : initial,
		queue: [],
	};

	const actions = oldHook ? oldHook.queue : [];
	actions.forEach((action) => {
		hook.state = action(hook.state);
	});

	const setState = (action) => {
		hook.queue.push(action);

		// state 的更新引起了组件开始的重新渲染
		wipRoot = {
			dom: currentRoot.dom,
			props: currentRoot.props,
			alternate: currentRoot,
		};
		nextUnitOfWork = wipRoot;
		deletions = [];
	};

	wipFiber.hooks.push(hook);
	hookIndex++;
	return [hook.state, setState];
}

export function useEffect(callback, deps) {
	const oldHook = wipFiber?.alternate?.hooks?.[hookIndex];
	const hasChangedDeps = deps
		? !oldHook || deps.some((dep, i) => dep !== oldHook.deps[i])
		: true;

	const hook = {
		deps,
		effect: callback,
	};

	if (hasChangedDeps) {
		hook.effect();
	}

	wipFiber.hooks.push(hook);
	hookIndex++;
}

function updateHostComponent(fiber) {
	// add dom node
	if (!fiber.dom) {
		fiber.dom = createDom(fiber);
	}

	//  create new fibers
	const elements = fiber.props.children;
	reconcileChildren(fiber, elements); // 为当前节点创建子节点的 fiber
}

// Fiber
// 当我们完成一个 Fiber 节点的渲染后，如果它有子节点 child，那么下一个工作单元就是这个 child
// 如果它没有子节点 child，那么它的兄弟节点 sibling 就是下一个工作单元
// 如果它既没有子节点 child，也没有兄弟节点 sibling，那么下一个工作单元是它父节点的兄弟节点 sibling
// 如果父节点也没有兄弟节点 sibling，那么我们就继续向上遍历，直到找到有 sibling 的节点，或者到达根节点
function reconcileChildren(wipFiber, elements) {
	let index = 0;
	let oldFiber = wipFiber?.alternate?.child;
	let prevSibling = null;

	while (index < elements.length || !!oldFiber) {
		const element = elements[index];
		let newFiber = null;

		const sameType = oldFiber && element && oldFiber.type === element.type;

		// update the node
		if (sameType) {
			newFiber = {
				type: oldFiber.type,
				props: element.props,
				parent: wipFiber,
				dom: oldFiber.dom,
				alternate: oldFiber,
				effectTag: EFFECT_TAGS.UPDATE,
			};
		}

		// add a new node
		if (element && !sameType) {
			newFiber = {
				type: element.type,
				props: element.props,
				parent: wipFiber,
				dom: null,
				alternate: null,
				effectTag: EFFECT_TAGS.PLACEMENT,
			};
		}

		// delete the old node
		if (oldFiber && !sameType) {
			oldFiber.effectTag = EFFECT_TAGS.DELETION;
			deletions.push(oldFiber);
		}

		if (oldFiber) {
			oldFiber = oldFiber.sibling;
		}

		if (index === 0) {
			wipFiber.child = newFiber;
		} else {
			prevSibling.sibling = newFiber;
		}

		prevSibling = newFiber;
		index++;
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
		props: {
			children: [element],
		},
		alternate: currentRoot,
	};
	deletions = [];
	nextUnitOfWork = wipRoot;
}
