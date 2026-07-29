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
}