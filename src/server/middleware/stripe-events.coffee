"use strict"
User = require("../models/user")
secrets = require("../config/secrets")
restify = require("restify")
nodemailer = require("nodemailer")
mailgunApiTransport = require("nodemailer-mailgunapi-transport")
moment = require("moment")
api = require("../middleware/api")
txn = require("../middleware/txn")

knownEvents =
    "customer.subscription.created": (req, res, next) ->
        invoiceId = req.stripeEvent.data.object.metadata.invoiceId
        console.log("Update invoice ", invoiceId)
        txn.update invoiceId, 'paid', req.query, (invoice) ->
            api.activate invoice.customerId, invoice.plan, 'stripe', (err, success) ->
                # error?
                return next(err) if err
                # success
                res.status(200).end()

    "customer.subscription.updated": (req, res, next) ->
        invoiceId = req.stripeEvent.data.object.metadata.invoiceId
        console.log("Update invoice ", invoiceId)
        txn.update invoiceId, 'paid', req.query, (invoice) ->
            api.activate invoice.customerId, '', 'stripe', (err, success) ->
                # error?
                return next(err) if err
                # success
                res.status(200).end()

    "customer.subscription.deleted": (req, res, next) ->
        console.log req.stripeEvent.type + ": event processed"
        if req.stripeEvent.data and req.stripeEvent.data.object and req.stripeEvent.data.object.customer

            # find user where stripeEvent.data.object.customer
            User.findOne
                "stripe.customerId": req.stripeEvent.data.object.customer,
                (err, user) ->
                    return next(err) if err
                    unless user
                        # user does not exist, no need to process
                        res.status(200).end()
                    else
                        user.stripe.last4 = ""
                        user.stripe.plan = "free"
                        user.stripe.subscriptionId = ""
                        user.save (err) ->
                            return next(err) if err
                            console.log "user: " + user.email + " subscription was successfully cancelled."
                            res.status(200).end()

        else
            next new Error("stripeEvent.data.object.customer is undefined")


module.exports = (req, res, next) ->
  if req.stripeEvent and req.stripeEvent.type and knownEvents[req.stripeEvent.type]
    knownEvents[req.stripeEvent.type] req, res, next
  else
    next new Error("Stripe Event not found")
  return
