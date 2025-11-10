import React from "react";
import "../styles/MembersList.css";

function MembersList({ members = [], onlineUsers = [] }) {
  if (!members || members.length === 0) {
    return (
      <div className="members-empty">
        <p>멤버 정보를 불러올 수 없습니다.</p>
      </div>
    );
  }

  const isOnline = (userId) => {
    return onlineUsers.includes(userId);
  };

  return (
    <div className="members-container">
      <h2>방 멤버 ({members.length}명)</h2>
      <div className="members-grid">
        {members.map((member) => (
          <div key={member.user_id} className="member-card">
            <div className="member-avatar">
              {member.users?.avatar_url ? (
                <img
                  src={member.users.avatar_url}
                  alt={member.users.display_name}
                />
              ) : (
                <div className="avatar-placeholder">
                  {(member.users?.display_name ||
                    member.users?.username ||
                    "?")[0].toUpperCase()}
                </div>
              )}
              {isOnline(member.user_id) && (
                <span className="online-badge">🟢</span>
              )}
            </div>
            <div className="member-info">
              <h3>{member.users?.display_name || member.users?.username}</h3>
              <p className="member-role">
                {member.role === "owner" ? "👑 방장" : "멤버"}
              </p>
              <p className="member-status">
                {isOnline(member.user_id) ? "온라인" : "오프라인"}
              </p>
              <p className="member-joined">
                가입일: {new Date(member.joined_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default MembersList;
