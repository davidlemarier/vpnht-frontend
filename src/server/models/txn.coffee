mongoose = require("mongoose")
txnSchema = new mongoose.Schema(
    customerId: String
    plan: String
    status: String
    billingType: String
    data: String
    xeroId: String
    amount: String
)

module.exports = mongoose.model("Txn", txnSchema)
