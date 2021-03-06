'use strict';

var User = require('../models/user');
var restify = require('restify');
var secrets = require('../config/secrets');
var txn = require("../middleware/txn");

// show user page

exports.getProfile = function (req, res, next) {
	var form = {},
		error = null,
		formFlash = req.flash('form'),
		errorFlash = req.flash('error');

	if (formFlash.length) {
		form.email = formFlash[0].email;
	}
	if (errorFlash.length) {
		error = errorFlash[0];
	}
	res.render(req.render, {
		user: req.user,
		form: form,
		error: error
	});
};

// Updates generic profile information

exports.postProfile = function (req, res, next) {
	req.assert('email', 'Email is not valid').isEmail();
	req.assert('name', 'Name is required').notEmpty();

	var errors = req.validationErrors();

	if (errors) {
		req.flash('errors', errors);
		return res.redirect(req.redirect.failure);
	}

	if (req.body.email != req.user.email) {
		User.findOne({
			email: req.body.email
		}, function (err, existingUser) {
			if (existingUser) {
				req.flash('errors', {
					msg: 'An account with that email address already exists.'
				});
				return res.redirect(req.redirect.failure);
			} else {
				User.findById(req.user.id, function (err, user) {
					if (err) return next(err);
					user.email = req.body.email || '';
					user.profile.name = req.body.name || '';
					user.profile.gender = req.body.gender || '';
					user.profile.location = req.body.location || '';
					user.profile.website = req.body.website || '';

					user.save(function (err) {
						if (err) return next(err);
						user.updateStripeEmail(function (err) {
							if (err) return next(err);
							req.flash('success', {
								msg: 'Profile information updated.'
							});
							res.redirect(req.redirect.success);
						});
					});
				});
			}
		});
	} else {
		User.findById(req.user.id, function (err, user) {
			if (err) return next(err);
			user.profile.name = req.body.name || '';
			user.profile.gender = req.body.gender || '';
			user.profile.location = req.body.location || '';
			user.profile.website = req.body.website || '';

			user.save(function (err) {
				if (err) return next(err);
				user.updateStripeEmail(function (err) {
					if (err) return next(err);
					req.flash('success', {
						msg: 'Profile information updated.'
					});
					res.redirect(req.redirect.success);
				});
			});
		});
	}
};

exports.postCoupon = function (req, res, next) {
	User.findById(req.user.id, function (err, user) {
		if (err) return next(err);
		user.setCoupon(req.body.coupon, function (err) {

			if (err) {
				req.flash('errors', {
					msg: err.message.toString() || 'Invalid coupon'
				});
				res.redirect(req.redirect.failure);
			} else {
				req.flash('success', {
					msg: 'Coupon updated.'
				});
				res.redirect(req.redirect.success);
			}
		});

	});
};

// Removes account

exports.deleteAccount = function (req, res, next) {
	User.findById(req.user.id, function (err, user) {
		if (err) return next(err);

		var client = restify.createStringClient({
			url: secrets.vpnht.url,
		});
		client.basicAuth(secrets.vpnht.key, secrets.vpnht.secret);
		client.del('/user/' + user.username, function (err, req2, res2, obj) {
			user.remove(function (err, user) {
				if (err) return next(err);
				user.cancelStripe(function (err) {
					if (err) return next(err);

					req.logout();
					req.flash('info', {
						msg: 'Your account has been deleted.'
					});
					res.redirect(req.redirect.success);
				});
			});
		});
	});
};

// Adds or updates a users card.

exports.postBilling = function (req, res, next) {
	var stripeToken = req.body.stripeToken;

	if (!stripeToken) {
		req.flash('errors', {
			msg: 'Please provide a valid card.'
		});
		return res.redirect(req.redirect.failure);
	}

	User.findById(req.user.id, function (err, user) {
		if (err) return next(err);

		user.setCard(stripeToken, function (err) {
			if (err) {
				if (err.code && err.code == 'card_declined') {
					req.flash('errors', {
						msg: 'Your card was declined. Please provide a valid card.'
					});
					return res.redirect(req.redirect.failure);
				}
				req.flash('errors', {
					msg: 'An unexpected error occurred.'
				});
				return res.redirect(req.redirect.failure);
			}
			req.flash('success', {
				msg: 'Billing has been updated.'
			});
			res.redirect(req.redirect.success);
		});
	});
};

exports.postPayment = function (req, res, next) {
	txn.add(req.user.stripe.customerId, req.body.plan, req.body.payment_method, req, function(err, invoice) {
		if (err) {
			return next(err);
		}
		// we have our invoice._id
		// so we can generate our link with the good payment platform

		if (invoice.billingType === 'cc') {
			// process stripe subscription...

			var card = {
				number: req.body.cc_no,
				exp_month: req.body.cc_expiry_month,
				exp_year: req.body.cc_expiry_year,
				cvc: req.body.cc_ccv,
				name: req.body.cc_first_name + ' ' + req.body.cc_last_name,
				address_zip: req.body.cc_zip
			};
			User.findById(req.user.id, function (err, user) {
				if (err) return next(err);
				user.createCard(card, function(err) {
					if (err) {
						console.log(err);
						req.flash("error", err.message);
						return res.redirect('/billing');
					}

					// ok our new customer have adefault card on his account !
					// we can set the plan and charge it =)
					user.setPlan(invoice._id, req.body.plan, false, function(err) {

						// ok we try to charge the card....
						if (err) {
							console.log(err);
							req.flash("error", err.message);
							return res.redirect('/billing');
						}

						// we mark our invoice as paid
						txn.update(invoice._id, 'paid', 'approved by stripe', function(user) {
							// ok plan has been charged successfully!
							req.flash("success", 'Congrats ! Your account is now active !');
							return res.redirect(req.redirect.success);
						});
					})

				})
			})

		} else {

			// if its another payment method, we need to send to another
			// link to process the payment

			var deal = req.body.coupon === 'POPCORNTIME' ? true : false;

			txn.prepare(invoice._id, deal, function(template) {
				// fix can't use _id as it print object
				invoice.id = invoice._id.toString();
				console.log(template);
				// render our hidden form and submot to process
				// payment on the external payment processor
				res.render(template, {invoice: invoice});
			});
		}

	});
}


exports.postPlan = function (req, res, next) {
	var plan = req.body.plan;
	var stripeToken = null;

	if (plan) {
		plan = plan.toLowerCase();
	}

	if (req.user.stripe.plan == plan) {
		req.flash('info', {
			msg: 'The selected plan is the same as the current plan.'
		});
		return res.redirect(req.redirect.success);
	}

	if (req.body.stripeToken) {
		stripeToken = req.body.stripeToken;
	}

	if (!req.user.stripe.last4 && !req.body.stripeToken) {
		req.flash('errors', {
			msg: 'Please add a card to your account before choosing a plan.'
		});
		return res.redirect(req.redirect.failure);
	}

	User.findById(req.user.id, function (err, user) {
		if (err) return next(err);

		user.setPlan(plan, stripeToken, function (err) {
			var msg;

			if (err) {
				if (err.code && err.code == 'card_declined') {
					msg = 'Your card was declined. Please provide a valid card.';
				} else if (err && err.message) {
					msg = err.message;
				} else {
					msg = 'An unexpected error occurred.';
				}

				req.flash('errors', {
					msg: msg
				});
				return res.redirect(req.redirect.failure);
			}
			req.flash('success', {
				msg: 'Plan has been updated.'
			});
			res.redirect(req.redirect.success);
		});
	});
};
