const PartnerRegistration = require("./../models/partnerRegistrationModel");
const factory = require("./handlerFactory");
const catchAsync = require("./../utils/catchAsync");

exports.getAllPartnerRegistrations = factory.getAll(PartnerRegistration);
exports.getPartnerRegistration = factory.getOne(PartnerRegistration);
exports.createPartnerRegistration = factory.createOne(PartnerRegistration);
exports.updatePartnerRegistration = factory.updateOne(PartnerRegistration);
exports.deletePartnerRegistration = factory.deleteOne(PartnerRegistration);
exports.getTablePartnerRegistration = factory.getTable(PartnerRegistration);

