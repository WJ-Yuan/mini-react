import * as MiniReact from "./react";

const element = document.createElement("h1");
element.nodeValue = "Test";

const container = document.querySelector("#app");
container.appendChild(element);
