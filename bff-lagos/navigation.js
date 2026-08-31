// ====== WEBSITE ROUTER ======

const routes = {
    home: "index.html",
    about: "about.html",
    staff: "staff.html",
    menu: "menu.html",
    careers: "careers.html",
    help: "help.html",
    contact: "contact.html"
};

/**
 * Navigate to any page
 * Usage:
 * goTo('home');
 * goTo('menu');
 * goTo('careers');
 */
function goTo(page) {
    if (routes[page]) {
        window.location.href = routes[page];
    } else {
        console.error(`Page "${page}" does not exist.`);
    }
};


const menuToggle = document.getElementById("menuToggle");
const mobileMenu = document.getElementById("mobileMenu");

menuToggle.addEventListener("click", () => {

    menuToggle.classList.toggle("active");

    mobileMenu.classList.toggle("active");

});

// Close menu after clicking a link

document.querySelectorAll(".mobile-menu a").forEach(link => {

    link.addEventListener("click", () => {

        menuToggle.classList.remove("active");

        mobileMenu.classList.remove("active");

    });

});
