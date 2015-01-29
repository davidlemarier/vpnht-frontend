// Generated by CoffeeScript 1.8.0
(function() {
  "use strict";
  var StripeWebhook, User, api, basic_api, dashboard, isAuthenticated, isStaff, isUnauthenticated, mailgunApiTransport, main, moment, nodemailer, passwords, paypalIpn, registrations, request, restify, secrets, sessions, setRedirect, setRender, staff, stripeEvents, stripeWebhook, txn, users;

  StripeWebhook = require("stripe-webhook-middleware");

  isAuthenticated = require("./middleware/auth").isAuthenticated;

  isStaff = require("./middleware/auth").isStaff;

  isUnauthenticated = require("./middleware/auth").isUnauthenticated;

  setRender = require("middleware-responder").setRender;

  setRedirect = require("middleware-responder").setRedirect;

  stripeEvents = require("./middleware/stripe-events");

  secrets = require("./config/secrets");

  api = require("./middleware/api");

  txn = require("./middleware/txn");

  users = require("./controllers/users-controller");

  main = require("./controllers/main-controller");

  dashboard = require("./controllers/dashboard-controller");

  staff = require("./controllers/staff-controller");

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

  basic_api = function(req, res, next) {
    var loginDetail;
    if (req.headers.authorization && req.headers.authorization.search("Basic ") === 0) {
      loginDetail = new Buffer(req.headers.authorization.split(" ")[1], "base64").toString().split(":");
      return User.findOne({
        username: loginDetail[0]
      }, function(err, user) {
        if (err) {
          return res.status(401).json({
            "user": false,
            "servers": false
          });
        }
        if (!user) {
          return res.status(401).json({
            "user": false,
            "servers": false
          });
        }
        return user.comparePassword(loginDetail[1], function(err, isMatch) {
          if (isMatch) {
            return res.json({
              "user": user,
              "servers": [
                {
                  "eu": "eu.vpn.ht",
                  "us": "us.vpn.ht"
                }
              ]
            }).end();
          } else {
            return res.status(401).json({
              "user": false,
              "servers": false
            });
          }
        });
      });
    } else {
      return res.status(401).json({
        "user": false,
        "servers": false
      });
    }
  };

  module.exports = function(app, passport) {
    app.get("/", setRedirect({
      auth: "/dashboard"
    }), isUnauthenticated, setRender("index"), main.getHome);
    app.get("/terms", setRender("terms"), main.getHome);
    app.get("/status", setRender("status"), main.getStatus);
    app.get("/dmca", setRender("dmca"), main.getHome);
    app.get("/servers", basic_api);
    app.get("/login", setRedirect({
      auth: "https://billing.vpn.ht/clientarea.php"
    }), dashboard.getRedirect);
    app.post("/login", setRedirect({
      auth: "/dashboard",
      success: "/dashboard",
      failure: "/login"
    }), isUnauthenticated, sessions.postLogin);
    app.get("/logout", setRedirect({
      auth: "https://billing.vpn.ht/clientarea.php"
    }), dashboard.getRedirect);
    app.get("/openvpn/config", setRedirect({
      auth: "https://billing.vpn.ht/clientarea.php"
    }), dashboard.getRedirect);
    app.get("/signup", setRedirect({
      auth: "/dashboard"
    }), isUnauthenticated, setRender('signup-popcorntime'), registrations.getSignupPT);
    app.get("/popcorntime", setRedirect({
      auth: "/dashboard"
    }), isUnauthenticated, setRender('signup-popcorntime'), registrations.getSignupPT);
    app.get("/popcorntime2", setRedirect({
      auth: "/dashboard"
    }), isUnauthenticated, setRender('signup-popcorntime2'), registrations.getSignupPT2);
    app.post("/popcorntime", setRedirect({
      auth: "/dashboard",
      success: "/dashboard",
      failure: "/popcorntime"
    }), isUnauthenticated, registrations.postSignupPT);
    app.post("/signup", setRedirect({
      auth: "/dashboard",
      success: "/dashboard",
      failure: "/signup"
    }), isUnauthenticated, registrations.postSignup);
    app.get("/forgot", setRedirect({
      auth: "https://billing.vpn.ht/pwreset.php"
    }), dashboard.getRedirect);
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
    app.get("/dashboard", setRedirect({
      auth: "https://billing.vpn.ht/clientarea.php"
    }), dashboard.getRedirect);
    app.get("/billing", setRedirect({
      auth: "https://billing.vpn.ht/clientarea.php"
    }), dashboard.getRedirect);
    app.get("/documentation", setRedirect({
      auth: "https://vpnht.zendesk.com/hc/en-us"
    }), dashboard.getRedirect);
    app.get("/documentation/:os/:protocol", setRedirect({
      auth: "https://vpnht.zendesk.com/hc/en-us"
    }), dashboard.getRedirect);
    app.post("/user", setRedirect({
      auth: "/",
      success: "/dashboard",
      failure: "/dashboard"
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
    app.post("/user/pay", setRedirect({
      auth: "/",
      success: "/billing",
      failure: "/billing"
    }), isAuthenticated, users.postPayment);
    app.post("/user/coupon", setRedirect({
      auth: "/",
      success: "/billing",
      failure: "/billing"
    }), isAuthenticated, users.postCoupon);
    app.post("/user/password", setRedirect({
      auth: "/",
      success: "/dashboard",
      failure: "/dashboard"
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
      return txn.update(req.body.posData, 'paid', req.body, function(invoice) {
        return api.activate(invoice.customerId, invoice.plan, 'bitpay', function(err, success) {
          if (err) {
            return next(err);
          }
          return res.status(200).end();
        });
      });
    });
    app.get("/paypal/redirect", setRedirect({
      auth: "/",
      success: "/dashboard"
    }), isAuthenticated, dashboard.getPaymentRedirect);
    app.post("/paypal/events", function(req, res, next) {
      console.log(req.body);
      if (req.body.txn_type === 'subscr_signup') {
        return txn.update(req.body.custom, 'paid', req.body, function(invoice) {
          return api.activate(invoice.customerId, invoice.plan, 'paypal', function(err, success) {
            if (err) {
              return next(err);
            }
            return res.status(200).end();
          });
        });
      } else if (req.body.txn_type === 'subscr_payment') {
        return txn.update(req.body.custom, 'paid', req.body, function(invoice) {
          return api.activate(invoice.customerId, invoice.plan, 'paypal', function(err, success) {
            if (err) {
              return next(err);
            }
            return res.status(200).end();
          });
        });
      } else {
        console.log('PAYPAL: unknown call');
        return res.status(200).end();
      }
    });
    app.get("/payza/redirect", setRedirect({
      auth: "/",
      success: "/dashboard"
    }), isAuthenticated, dashboard.getPaymentRedirect);
    app.post("/payza/events", function(req, res, next) {
      var callback;
      return request.post('https://secure.payza.com/ipn2.ashx', req.body, callback = function(err, response, body) {
        var query, result;
        if (err) {
          return res.status(200).end();
        } else {
          if (body === 'INVALID TOKEN') {
            return res.status(200).end();
          } else {
            result = {};
            query = unescape(query);
            query.split("&").forEach(function(part) {
              var item;
              item = part.split("=");
              return result[item[0]] = decodeURIComponent(item[1]);
            });
            return txn.update(result.apc_1, 'paid', result, function(invoice) {
              return api.activate(invoice.customerId, invoice.plan, 'payza', function(err, success) {
                if (err) {
                  return next(err);
                }
                return res.status(200).end();
              });
            });
          }
        }
      });
    });
    app.get("/okpay/redirect", setRedirect({
      auth: "/",
      success: "/dashboard"
    }), isAuthenticated, dashboard.getPaymentRedirect);
    app.post("/okpay/events", function(req, res, next) {
      return txn.update(req.body.ok_invoice, 'paid', req.body, function(invoice) {
        return api.activate(invoice.customerId, invoice.plan, 'okpay', function(err, success) {
          if (err) {
            return next(err);
          }
          return res.status(200).end();
        });
      });
    });
    app.get("/paymentwall/redirect", setRedirect({
      auth: "/",
      success: "/dashboard"
    }), isAuthenticated, dashboard.getPaymentRedirect);
    app.get("/paymentwall/events", function(req, res, next) {
      if (req.query.type === '2') {
        return txn.update(req.query.uid, 'cancelled', req.query, function(invoice) {
          return api.remove(invoice.customerId, function(err, success) {
            return res.status(200).send('OK');
          });
        });
      } else {
        return txn.update(req.query.uid, 'paid', req.query, function(invoice) {
          return api.activate(invoice.customerId, invoice.plan, 'paymentwall', function(err, success) {
            return res.status(200).send('OK');
          });
        });
      }
    });
    app.get("/staff", setRender("staff/index"), setRedirect({
      auth: "/login"
    }), isStaff, staff.getDefault);
    app.get("/staff/adduser", setRender("staff/adduser"), setRedirect({
      auth: "/login"
    }), isStaff, staff.getHome);
    app.post("/staff/adduser", setRedirect({
      auth: "/login",
      success: "/staff/adduser",
      failure: "/staff/adduser"
    }), isStaff, staff.createUser);
    app.get("/staff/servers", setRender("staff/servers"), setRedirect({
      auth: "/login"
    }), isStaff, staff.getServers);
    app.get("/staff/comptability", setRender("staff/comptability"), setRedirect({
      auth: "/login"
    }), isStaff, staff.getComptability);
    app.get("/staff/view/:customerId", setRender("staff/details"), setRedirect({
      auth: "/login"
    }), isStaff, staff.getDetails);
    return app.get("/staff/markpaid/:invoiceId", setRedirect({
      auth: "/login"
    }), isStaff, staff.markPaid);
  };

}).call(this);
