// Generated by CoffeeScript 1.8.0
(function() {
  "use strict";
  var StripeWebhook, User, api, dashboard, isAuthenticated, isUnauthenticated, mailgunApiTransport, main, moment, nodemailer, passwords, paypalIpn, registrations, request, restify, secrets, sessions, setRedirect, setRender, stripeEvents, stripeWebhook, users;

  StripeWebhook = require("stripe-webhook-middleware");

  isAuthenticated = require("./middleware/auth").isAuthenticated;

  isUnauthenticated = require("./middleware/auth").isUnauthenticated;

  setRender = require("middleware-responder").setRender;

  setRedirect = require("middleware-responder").setRedirect;

  stripeEvents = require("./middleware/stripe-events");

  secrets = require("./config/secrets");

  api = require("./middleware/api");

  users = require("./controllers/users-controller");

  main = require("./controllers/main-controller");

  dashboard = require("./controllers/dashboard-controller");

  passwords = require("./controllers/passwords-controller");

  registrations = require("./controllers/registrations-controller");

  sessions = require("./controllers/sessions-controller");

  User = require("./models/user");

  restify = require("restify");

  nodemailer = require("nodemailer");

  mailgunApiTransport = require("nodemailer-mailgunapi-transport");

  moment = require("moment");

  stripeWebhook = new StripeWebhook({
    stripeApiKey: secrets.stripeOptions.apiKey,
    respond: true
  });

  paypalIpn = require('paypal-ipn');

  request = require('request');

  module.exports = function(app, passport) {
    app.all("*", function(req, res, next) {
      if (req.headers["x-forwarded-proto"] !== "https" && process.env.NODE_ENV === "production") {
        return res.redirect("https://vpn.ht" + req.url);
      } else {
        return next();
      }
    });
    app.get("/", setRedirect({
      auth: "/dashboard"
    }), isUnauthenticated, setRender("index"), main.getHome);
    app.get("/login", setRedirect({
      auth: "/dashboard"
    }), isUnauthenticated, setRender("login"), main.getHome);
    app.post("/login", setRedirect({
      auth: "/dashboard",
      success: "/dashboard",
      failure: "/login"
    }), isUnauthenticated, sessions.postLogin);
    app.get("/logout", setRedirect({
      auth: "/",
      success: "/"
    }), isAuthenticated, sessions.logout);
    app.get("/openvpn/config", setRedirect({
      auth: "/",
      success: "/"
    }), isAuthenticated, dashboard.getOpenvpn);
    app.get("/signup", setRedirect({
      auth: "/dashboard"
    }), isUnauthenticated, setRender('signup'), registrations.getSignup);
    app.post("/signup", setRedirect({
      auth: "/dashboard",
      success: "/dashboard",
      failure: "/signup"
    }), isUnauthenticated, registrations.postSignup);
    app.get("/forgot", setRedirect({
      auth: "/dashboard"
    }), isUnauthenticated, setRender("forgot"), passwords.getForgotPassword);
    app.post("/forgot", setRedirect({
      auth: "/dashboard",
      success: "/forgot",
      failure: "/forgot"
    }), isUnauthenticated, passwords.postForgotPassword);
    app.get("/reset/:token", setRedirect({
      auth: "/dashboard",
      failure: "/forgot"
    }), isUnauthenticated, setRender("reset"), passwords.getToken);
    app.post("/reset/:token", setRedirect({
      auth: "/dashboard",
      success: "/dashboard",
      failure: "back"
    }), isUnauthenticated, passwords.postToken);
    app.get("/dashboard", setRender("dashboard/index"), setRedirect({
      auth: "/"
    }), isAuthenticated, dashboard.getDefault);
    app.get("/billing", setRender("dashboard/billing"), setRedirect({
      auth: "/"
    }), isAuthenticated, dashboard.getBilling);
    app.get("/profile", setRender("dashboard/profile"), setRedirect({
      auth: "/"
    }), isAuthenticated, dashboard.getProfile);
    app.get("/documentation", setRender("dashboard/documentation/list"), setRedirect({
      auth: "/"
    }), isAuthenticated, dashboard.getDocumentation);
    app.get("/documentation/:os/:protocol", function(req, res, next) {
      req.render = "dashboard/documentation/" + req.params.os + "-" + req.params.protocol;
      return next();
    }, setRedirect({
      auth: '/login'
    }), isAuthenticated, dashboard.getDocumentation);
    app.post("/user", setRedirect({
      auth: "/",
      success: "/profile",
      failure: "/profile"
    }), isAuthenticated, users.postProfile);
    app.post("/user/billing", setRedirect({
      auth: "/",
      success: "/billing",
      failure: "/billing"
    }), isAuthenticated, users.postBilling);
    app.post("/user/plan", setRedirect({
      auth: "/",
      success: "/billing",
      failure: "/billing"
    }), isAuthenticated, users.postPlan);
    app.post("/user/coupon", setRedirect({
      auth: "/",
      success: "/billing",
      failure: "/billing"
    }), isAuthenticated, users.postCoupon);
    app.post("/user/password", setRedirect({
      auth: "/",
      success: "/profile",
      failure: "/profile"
    }), isAuthenticated, passwords.postNewPassword);
    app.post("/user/delete", setRedirect({
      auth: "/",
      success: "/"
    }), isAuthenticated, users.deleteAccount);
    app.post("/stripe/events", stripeWebhook.middleware, stripeEvents);
    app.get("/bitpay/redirect", setRedirect({
      auth: "/",
      success: "/dashboard"
    }), isAuthenticated, dashboard.getPaymentRedirect);
    app.post("/bitpay/events", function(req, res, next) {
      var obj;
      obj = req.body;
      if (obj.status === "complete" && obj.amount === "39.99" && obj.posData) {
        return api.activate(obj.posData, 'yearly', 'bitpay', function(err, success) {
          if (err) {
            return next(err);
          }
          return res.status(200).end();
        });
      } else if (obj.status === "complete" && obj.posData) {
        return api.activate(obj.posData, 'monthly', 'bitpay', function(err, success) {
          if (err) {
            return next(err);
          }
          return res.status(200).end();
        });
      } else {
        return res.status(200).end();
      }
    });
    app.get("/paypal/redirect", setRedirect({
      auth: "/",
      success: "/dashboard"
    }), isAuthenticated, dashboard.getPaymentRedirect);
    app.post("/paypal/events", function(req, res, next) {
      var callback;
      console.log(req.body);
      return paypalIpn.verify(req.body, callback = function(err, msg) {
        var params;
        if (err) {
          return res.status(200).end();
        } else {
          if (req.param('payment_status') === 'Completed') {
            params = req.param('custom').split('||');
            return api.activate(params[0], params[1], 'paypal', function(err, success) {
              if (err) {
                return next(err);
              }
              return res.status(200).end();
            });
          }
        }
      });
    });
    app.get("/payza/redirect", setRedirect({
      auth: "/",
      success: "/dashboard"
    }), isAuthenticated, dashboard.getPaymentRedirect);
    return app.post("/payza/events", function(req, res, next) {
      var callback, util;
      console.log(req.body);
      util = require('util');
      return request.post('https://secure.payza.com/ipn2.ashx', req.body, callback = function(err, param) {
        if (err) {
          return res.status(200).end();
        } else {
          console.log(util.inspect(param, false, 2, true));
          console.log(param.toString());
          if (param === 'INVALID TOKEN') {
            return res.status(200).end();
          } else {
            return api.activate(param.apc_1, param.ap_itemcode, 'payza', function(err, success) {
              if (err) {
                return next(err);
              }
              return res.status(200).end();
            });
          }
        }
      });
    });
  };

}).call(this);
