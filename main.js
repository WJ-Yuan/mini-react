import * as MiniReact from "./react";

const Counter = () => {
	const [state, setState] = MiniReact.useState(1);

	return MiniReact.createElement(
		"h1",
		null,
		"Count: ",
		state,
		MiniReact.createElement(
			"button",
			{
				onclick: () => {
					setState((state) => state + 1);
				},
			},
			"+1",
		),
	);
};

const element = MiniReact.createElement(Counter, null);
const container = document.querySelector("#app");
MiniReact.render(element, container);
