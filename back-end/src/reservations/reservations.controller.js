const service = require("./reservations.service");
const asyncErrorBoundary = require("../errors/asyncErrorBoundary");
const hasProperties = require("../errors/hasProperties");

const hasRequiredProperties = hasProperties(
  "first_name",
  "last_name",
  "mobile_number",
  "reservation_date",
  "reservation_time",
  "people"
);
/**
 * List handler for reservation resources
 */
async function list(req, res) {
  let data;

  if (req.query.date) {
    data = await service.list(req.query.date);
  } else if (req.query.mobile_number) {
    data = await service.search(req.query.mobile_number);
  }

  res.json({ data });
}

async function reservationExists(req, res, next) {
  const reservationId = parseInt(req.params.reservation_id);

  const reservation = await service.read(reservationId);

  if (reservation) {
    res.locals.reservation = reservation;
    return next();
  } else {
    next({
      status: 404,
      message: `reservation ${reservationId} does not exist`,
    });
  }
}

function read(req, res) {
  const { reservation: data } = res.locals;

  res.json({ data });
}

function peoplePropertyIsNumber(req, _, next) {
  if (typeof req.body.data.people === "number") next();
  else {
    next({
      status: 400,
      message: "people property must be a number",
    });
  }
}

function reservationDateFormatted(req, _, next) {
  let regEx = /^\d{4}-\d{2}-\d{2}$/;
  let stored = req.body.data.reservation_date.match(regEx) != null;
  if (stored) next();
  else {
    next({
      status: 400,
      message: "reservation_date must be in correct format: YYYY/MM/DD",
    });
  }
}

function reservationTimeFormatted(req, _, next) {
  let regEx = /^(?:2[0-3]|[01]?[0-9]):[0-5][0-9]:[0-5][0-9]$/;
  let regEx2 = /^(?:2[0-3]|[01]?[0-9]):[0-5][0-9]$/;
  let regEx3 = /^(?:2[0-3]|[01]?[0-9])/;
  let stored = req.body.data.reservation_time.match(regEx) != null;
  let stored2 = req.body.data.reservation_time.match(regEx2) != null;
  let stored3 = req.body.data.reservation_time.match(regEx3) != null;
  if (stored || stored2 || stored3) next();
  else {
    next({
      status: 400,
      message: "reservation_time must be in correct format: HH:MM:SS",
    });
  }
}

function formatAsDateTimeInstance(dateString, timeString) {
  let dateParts = dateString.split("-");

  dateParts = dateParts.map((part) => parseInt(part));

  let timeParts = timeString.split(":");

  timeParts = timeParts.map((part) => parseInt(part, 10));

  return new Date(
    dateParts[0],
    dateParts[1] - 1,
    dateParts[2],
    timeParts[0],
    timeParts[1],
    0,
    0
  );
}

function reservationDateNotTuesday(req, _, next) {
  const date = formatAsDateTimeInstance(
    req.body.data.reservation_date,
    req.body.data.reservation_time
  );

  if (date.getDay() === 2) {
    next({
      status: 400,
      message: "the restaurant is closed on Tuesdays",
    });
  }

  next();
}

function reservationDateNotInPast(req, _, next) {
  const date = formatAsDateTimeInstance(
    req.body.data.reservation_date,
    req.body.data.reservation_time
  ).getTime();

  const today = new Date().getTime();

  if (date < today) {
    next({
      status: 400,
      message: "reservations must be made only for future dates",
    });
  }

  next();
}

function reservationDuringValidHours(req, _, next) {
  const time = req.body.data.reservation_time;

  const hrs = parseInt(time.split(":")[0], 10);
  const mins = parseInt(time.split(":")[1], 10);

  if (
    hrs < 10 ||
    (hrs === 10 && mins < 30) ||
    hrs > 21 ||
    (hrs === 21 && mins > 30)
  ) {
    next({
      status: 400,
      message: "reservations must be made between 10:30 AM and 9:30 PM",
    });
  }

  next();
}

function statusIsNotSeatedOrFinished(req, res, next) {
  const { status } = req.body.data;

  if (status && status !== "booked") {
    next({
      status: 400,
      message: `status cannot be ${status}`,
    });
  }

  next();
}

async function create(req, res) {
  const data = await service.create(req.body.data);
  res.status(201).json({ data });
}

function statusIsKnown(req, res, next) {
  const { status } = req.body.data;

  const knownStatuses = ["booked", "seated", "finished", "cancelled"];

  if (!knownStatuses.includes(status)) {
    next({
      status: 400,
      message: `status ${status} is unknown. must be booked, seated, finished or cancelled`,
    });
  }

  res.locals.status = status;
  next();
}

function reservationStatusIsNotAlreadyFinished(req, res, next) {
  if (res.locals.reservation.status === "finished") {
    next({
      status: 400,
      message: "finished reservations cannot be updated",
    });
  }

  next();
}

async function updateStatus(req, res) {
  const { reservation_id } = res.locals.reservation;

  const { status } = res.locals;

  const data = await service.update(reservation_id, status);

  res.status(200).json({ data });
}

function reservationStatusIsBooked(req, res, next) {
  if (res.locals.reservation.status !== "booked") {
    next({
      status: 400,
      message: "only reservations with a status of booked can be edited",
    });
  }

  next();
}

async function update(req, res) {
  const { reservation_id } = res.locals.reservation;

  const data = await service.update(reservation_id, req.body.data);

  res.status(200).json({ data });
}

module.exports = {
  list,
  read: [asyncErrorBoundary(reservationExists), read],
  create: [
    hasRequiredProperties,
    peoplePropertyIsNumber,
    reservationDateFormatted,
    reservationTimeFormatted,
    reservationDateNotTuesday,
    reservationDateNotInPast,
    reservationDuringValidHours,
    statusIsNotSeatedOrFinished,
    asyncErrorBoundary(create),
  ],
  updateStatus: [
    asyncErrorBoundary(reservationExists),
    statusIsKnown,
    reservationStatusIsNotAlreadyFinished,
    asyncErrorBoundary(updateStatus),
  ],
  update: [
    asyncErrorBoundary(reservationExists),
    hasRequiredProperties,
    peoplePropertyIsNumber,
    reservationDateFormatted,
    reservationTimeFormatted,
    reservationDateNotTuesday,
    reservationDateNotInPast,
    reservationDuringValidHours,
    reservationStatusIsBooked,
    asyncErrorBoundary(update),
  ],
};
