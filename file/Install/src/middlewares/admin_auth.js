const adminAuth = (req, res, next) => {
    // Check if user is logged in
    if (!req.session.user) {
        return res.redirect("/auth/login");
    }

    // Check if user is admin
    if (req.session.user.user_type !== 'admin') {
        return res.redirect("/");
    }

    // Check if user is active
    if (!req.session.user.is_active) {
        req.session.destroy();
        return res.redirect("/auth/login");
    }

    next();
}

export default adminAuth;