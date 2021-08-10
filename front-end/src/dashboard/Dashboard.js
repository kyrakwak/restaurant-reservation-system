import React, { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import {
  listReservations,
  listTables,
  deleteTableAssignment,
  updateReservationStatus,
} from "../utils/api";
import { today, next, previous } from "../utils/date-time";
import useQuery from "../utils/useQuery";
import ReservationItem from "./ReservationItem";
import TableItem from "./TableItem";
import ErrorAlert from "../layout/ErrorAlert";

/**
 * Defines the dashboard page.
 * @param date
 *  the date for which the user wants to view reservations.
 * @returns {JSX.Element}
 */
function Dashboard() {
  const query = useQuery();
  let date = query.get("date");

  if (!date) {
    date = today();
  }

  const history = useHistory();

  const [reservations, setReservations] = useState([]);
  const [reservationsError, setReservationsError] = useState(null);
  const [reservation_date, setReservationDate] = useState(date);
  const [tables, setTables] = useState([]);

  useEffect(loadDashboard, [reservation_date]);

  function loadDashboard() {
    const abortController = new AbortController();
    setReservationsError(null);
    listReservations({ date: reservation_date }, abortController.signal)
      .then(setReservations)
      .catch(setReservationsError);
    listTables(abortController.signal).then(setTables);
    return () => abortController.abort();
  }

  const handleNextButton = () => {
    setReservationDate(next(reservation_date));
    history.push(`/dashboard/?date=${next(reservation_date)}`);
  };

  const handlePreviousButton = () => {
    setReservationDate(previous(reservation_date));
    history.push(`/dashboard/?date=${previous(reservation_date)}`);
  };

  const handleTodayButton = () => {
    setReservationDate(today());
    history.push(`/dashboard`);
  };

  const handleFinishButton = (table) => {
    const abortController = new AbortController();
    if (
      window.confirm(
        "Is this table ready to seat new guests? This cannot be undone."
      )
    ) {
      deleteTableAssignment(table.table_id, abortController.signal)
        .then(() => listTables(abortController.signal))
        .then(setTables);

      const reservationStatus = {
        status: "finished",
      };

      updateReservationStatus(
        table.reservation_id,
        reservationStatus,
        abortController.signal
      )
        .then(() =>
          listReservations({ date: reservation_date }, abortController.signal)
        )
        .then(setReservations)
        .catch(setReservationsError);
    }
    return () => abortController.abort();
  };

  const handleCancelButton = (reservation) => {
    const abortController = new AbortController();
    if (
      window.confirm(
        "Do you want to cancel this reservation? This cannot be undone."
      )
    ) {
      const reservationStatus = {
        status: "cancelled",
      };

      updateReservationStatus(
        reservation.reservation_id,
        reservationStatus,
        abortController.signal
      )
        .then(() =>
          listReservations({ date: reservation_date }, abortController.signal)
        )
        .then(setReservations)
        .catch(setReservationsError);
    }
    return () => abortController.abort();
  };

  return (
    <main>
      <h1 className="text-center">Dashboard</h1>
      <div className="d-flex justify-content-between">
        <div>
          <div className="d-md-flex justify-content-center mb-3">
            <h3 className="mb-0">Reservations for {reservation_date}</h3>
          </div>
          <ErrorAlert error={reservationsError} />
          <ul className="list-group my-2">
            {reservations.map((reservation) => (
              <ReservationItem
                key={reservation.reservation_id}
                reservation={reservation}
                handleCancelButton={handleCancelButton}
              />
            ))}
          </ul>
        </div>
        <div>
          <div className="d-md-flex justify-content-center mb-3">
            <h3 className="mb-0">Tables</h3>
          </div>
          <ul className="list-group my-2">
            {tables.map((table) => (
              <TableItem
                key={table.table_id}
                table={table}
                handleFinishButton={handleFinishButton}
              />
            ))}
          </ul>
        </div>
      </div>
      <div className="d-flex justify-content-center">
        <button type="button" onClick={handleNextButton}>
          Next
        </button>
        <button type="button" onClick={handlePreviousButton}>
          Previous
        </button>
        <button type="button" onClick={handleTodayButton}>
          Today
        </button>
      </div>
    </main>
  );
}

export default Dashboard;
