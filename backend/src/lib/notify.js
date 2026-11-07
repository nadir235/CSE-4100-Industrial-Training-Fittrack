'use strict';

/** Writes an in-app notification document for a member (inbox shown in the app). */
function notificationDoc(db, uid) {
  return db.collection('users').doc(uid).collection('notifications').doc();
}

function notificationData({ title, body, kind }) {
  return { title, body, kind, at: Date.now(), read: false };
}

module.exports = { notificationDoc, notificationData };
