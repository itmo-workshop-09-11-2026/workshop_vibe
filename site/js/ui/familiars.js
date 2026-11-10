"use strict";

for (const button of document.querySelectorAll("[data-familiar-cast]")) {
  const familiar = button.closest("[data-familiar]");
  let reset;

  button.addEventListener("click", () => {
    window.clearTimeout(reset);
    familiar.classList.remove("is-conjuring");
    void familiar.offsetWidth;
    familiar.classList.add("is-conjuring");
    reset = window.setTimeout(() => familiar.classList.remove("is-conjuring"), 1700);
  });
}
