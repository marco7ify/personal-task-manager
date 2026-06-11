import { useEffect } from 'react';
import { Store, getToday } from '../utils/store';
import { pageReviewStatus } from '../utils/mastery';

const SENT_KEY = 'ut_notifications_sent_v1';

function readSent() {
  try {
    return JSON.parse(sessionStorage.getItem(SENT_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeSent(sent) {
  sessionStorage.setItem(SENT_KEY, JSON.stringify(sent));
}

function minutesUntil(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const due = new Date(`${dateStr}T${timeStr}`);
  if (Number.isNaN(due.getTime())) return null;
  return Math.round((due.getTime() - Date.now()) / 60000);
}

function sendNotification(id, title, body) {
  const sent = readSent();
  if (sent[id]) return;
  new Notification(title, { body });
  sent[id] = Date.now();
  writeSent(sent);
}

function checkTaskNotifications(leadMinutes) {
  const today = getToday();
  (Store.items || [])
    .filter((item) => !item.done && !item.archived && item.date === today && item.time)
    .forEach((item) => {
      const mins = minutesUntil(item.date, item.time);
      if (mins == null || mins < 0 || mins > leadMinutes) return;
      sendNotification(
        `task:${item.id}:${item.date}:${item.time}`,
        item.type === 'event' ? 'Event coming up' : 'Task due soon',
        `${item.text || 'Untitled item'} at ${item.time}`
      );
    });
}

function checkStudyNotifications() {
  const today = getToday();
  const duePages = (Store.pages || []).filter((page) =>
    ['missed', 'due_today'].includes(pageReviewStatus(page, today))
  );
  if (duePages.length === 0) return;
  sendNotification(
    `study:${today}`,
    'Study reviews ready',
    `${duePages.length} page${duePages.length === 1 ? '' : 's'} due in Study Queue`
  );
}

function checkJobNotifications() {
  const today = getToday();
  const dueJobs = (Store.jobs || []).filter((job) =>
    job.followUpDate &&
    job.followUpDate <= today &&
    !['accepted', 'rejected'].includes(job.status)
  );
  if (dueJobs.length === 0) return;
  sendNotification(
    `jobs:${today}`,
    'Job follow-ups due',
    `${dueJobs.length} application${dueJobs.length === 1 ? '' : 's'} need follow-up`
  );
}

export function NotificationCenter({ enabled }) {
  useEffect(() => {
    if (!enabled) return undefined;
    if (!('Notification' in window)) return undefined;
    if (!Store.settings.notificationsEnabled) return undefined;
    if (Notification.permission !== 'granted') return undefined;

    const check = () => {
      const leadMinutes = Math.max(1, Number(Store.settings.notificationLeadMinutes) || 15);
      if (Store.settings.notificationTasks !== false) checkTaskNotifications(leadMinutes);
      if (Store.settings.notificationStudy !== false) checkStudyNotifications();
      if (Store.settings.notificationJobs !== false) checkJobNotifications();
    };

    check();
    const interval = window.setInterval(check, 60000);
    return () => window.clearInterval(interval);
  }, [enabled]);

  return null;
}
