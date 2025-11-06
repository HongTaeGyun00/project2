import React from "react";
import "../styles/NotificationBar.css";

function NotificationBar({ notifications }) {
  if (notifications.length === 0) return null;

  return (
    <div className="notification-bar">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`notification notification-${notification.type}`}
        >
          {notification.message}
        </div>
      ))}
    </div>
  );
}

export default NotificationBar;
