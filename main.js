import * as MiniReact from "./react";

const element = MiniReact.createElement(
	"h1",
	{
		id: "foo",
	},
	MiniReact.createElement("a", null, "bar"),
	MiniReact.createElement("b"),
);

const container = document.querySelector("#app");
MiniReact.render(element, container);
