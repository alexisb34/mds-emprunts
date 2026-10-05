// js/admin/views/dashboard.js — tableau de bord : KPI, retards, remises du jour, signalements, journal.
import { store } from '../../store.js';
import { now } from '../../rules.js';
import { recentLog, ACTION_LABELS } from '../../log.js';
import { navigate } from '../../router.js';
import { escapeHtml, badge, avatar, formatDate, formatTime, relativeDay, formatSlots, fullName } from '../../ui.js';
import { officeStatus } from '../../actions/settings.js';
import { setTopbar } from '../layout.js';
import { demoClockHtml, bindDemoClock } from '../demoClock.js';
import { openHandoverModal } from '../handoverModal.js';
import { computeKpis, lateLoans, dueTodayReservations, openReports, exitMissingRows } from '../kpi.js';

const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

function kpiCard(label, value, extra = '', variant = '') {
  return `<div class="kpi ${variant}"><span class="kpi__label">${escapeHtml(label)}</span><span class="kpi__value">${value}</span><span class="kpi__delta">${escapeHtml(extra)}</span></div>`;
}

function lateRows(late, date) {
  if (!late.length) return '<div class="empty-state">Aucun retard. 🎉</div>';
  return `<table class="table"><thead><tr><th>Matériel</th><th>Emprunteur</th><th>Retour prévu</th><th>Retard</th></tr></thead><tbody>${late.map(({ loan, item, user, joursRetard }) => `
    <tr data-href="/materiel/${escapeHtml(loan.itemId)}">
      <td><strong>${escapeHtml(item ? item.nom : loan.itemId)}</strong></td>
      <td>${user ? `<span class="row">${avatar(user)}${escapeHtml(fullName(user))}</span>` : '—'}</td>
      <td>${escapeHtml(relativeDay(loan.finPrevue, date))}</td>
      <td>${badge('loan', 'en_retard')} <span class="body-tiny text-secondary">${plural(joursRetard, 'jour', 'jours')}</span></td>
    </tr>`).join('')}</tbody></table>`;
}

function dueList(due) {
  if (!due.length) return '<div class="empty-state">Aucune remise prévue aujourd’hui.</div>';
  return `<div class="list">${due.map(({ loan, item, user }) => `
    <div class="list__item" data-href="/materiel/${escapeHtml(loan.itemId)}">
      ${user ? avatar(user) : ''}
      <div class="list__grow"><strong>${escapeHtml(item ? item.nom : loan.itemId)}</strong><span class="activity__detail">${user ? escapeHtml(fullName(user)) : '—'} · retrait à ${escapeHtml(formatTime(loan.debutPrevu))} · code ${escapeHtml(loan.codeRetrait || '')}</span></div>
      ${badge('loan', loan.statut)}
      <button type="button" class="btn btn--primary btn--sm" data-action="handover" data-loan="${escapeHtml(loan.id)}">Remettre</button>
    </div>`).join('')}</div>`;
}

function reportsList(reports) {
  if (!reports.length) return '<div class="empty-state">Aucun signalement ouvert.</div>';
  return `<div class="list">${reports.map(({ event, item, auteur }) => `
    <div class="list__item" data-href="${event.itemId ? `/materiel/${escapeHtml(event.itemId)}` : '/salle'}">
      <div class="list__grow"><strong>${escapeHtml(item ? item.nom : (event.bookingId ? 'Salle photo — état des lieux' : event.itemId))}</strong><span class="activity__detail">${escapeHtml(event.description)}</span><span class="activity__detail">${escapeHtml(formatDate(event.date))}${auteur ? ` · ${escapeHtml(fullName(auteur))}` : ''}</span></div>
      ${badge('maint', event.statut)}
    </div>`).join('')}</div>`;
}

function exitMissingHtml(rows) {
  if (!rows.length) return '';
  return `
    <div class="card">
      <div class="card__header"><h2 class="card__title">Sorties non faites</h2><a class="body-sm" href="#/salle">Voir le planning →</a></div>
      ${rows.map(({ booking, user }) => `<div class="alert alert--warning">${escapeHtml(formatDate(booking.date))} · ${escapeHtml(formatSlots(booking.creneaux))} — ${escapeHtml(user ? fullName(user) : booking.userId)}</div>`).join('')}
    </div>`;
}

function activityList(activity, users, date) {
  if (!activity.length) return '<div class="empty-state">Aucune activité.</div>';
  const nameOf = (id) => { const u = users.find((x) => x.id === id); return u ? fullName(u) : id; };
  return `<div class="activity">${activity.map((e) => `
    <div class="activity__item">
      <span class="activity__time">${escapeHtml(relativeDay(e.date, date))}<br>${escapeHtml(formatTime(e.date))}</span>
      <div><strong>${escapeHtml(ACTION_LABELS[e.action] || e.action)}</strong> <span class="text-secondary">· ${escapeHtml(nameOf(e.auteurId))}</span><span class="activity__detail">${escapeHtml(e.detail)}</span></div>
    </div>`).join('')}</div>`;
}

export function dashboardHtml({ kpis, late, due, reports, activity, users, date, horlogeDemo, status, exitMissing = [] }) {
  return `
    ${demoClockHtml({ date, horlogeDemo, status })}
    <div class="grid-4">
      ${kpiCard('Matériel disponible', kpis.disponibles, 'exemplaires prêts à être empruntés')}
      ${kpiCard('Emprunts en cours', kpis.enCours, `${plural(kpis.aRemettre, 'remise prévue', 'remises prévues')} aujourd’hui`, 'kpi--brand')}
      ${kpiCard('Retards', kpis.retards, kpis.retards ? 'à relancer' : 'tout est rentré', kpis.retards ? 'kpi--alert' : '')}
      ${kpiCard('Réservations salle à venir', kpis.reservationsSalle, `${plural(kpis.signalements, 'signalement ouvert', 'signalements ouverts')}`, 'kpi--teal')}
    </div>
    <div class="grid-2">
      <div class="stack">
        <div class="card"><div class="card__header"><h2 class="card__title">Retards</h2><a class="body-sm" href="#/emprunts">Tout voir →</a></div>${lateRows(late, date)}</div>
        <div class="card"><div class="card__header"><h2 class="card__title">À remettre aujourd’hui</h2></div>${dueList(due)}</div>
      </div>
      <div class="stack">
        <div class="card"><div class="card__header"><h2 class="card__title">Signalements ouverts</h2><a class="body-sm" href="#/maintenance">Tout voir →</a></div>${reportsList(reports)}</div>
        ${exitMissingHtml(exitMissing)}
        <div class="card"><div class="card__header"><h2 class="card__title">Dernières activités</h2></div>${activityList(activity, users, date)}</div>
      </div>
    </div>`;
}

export function dashboardView(container) {
  const render = () => {
    const date = now();
    const data = {
      items: store.items.list(), loans: store.loans.list(), bookings: store.bookings.list(),
      maintenance: store.maintenance.list(), users: store.users.list(),
    };
    const settings = store.settings.get();
    setTopbar({ title: 'Tableau de bord', subtitle: formatDate(date) });
    container.innerHTML = dashboardHtml({
      kpis: computeKpis(data, date), late: lateLoans(data, date), due: dueTodayReservations(data, date),
      reports: openReports(data), activity: recentLog(15), users: data.users, date,
      horlogeDemo: settings.horlogeDemo || null, status: officeStatus(date, settings),
      exitMissing: exitMissingRows(data.bookings, data.users, date),
    });
    container.querySelectorAll('[data-href]').forEach((el) => el.addEventListener('click', () => navigate(el.dataset.href)));
    container.querySelectorAll('[data-action="handover"]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); openHandoverModal({ loan: store.loans.get(b.dataset.loan) || null }); }));
    bindDemoClock(container, { date });
  };
  render();
  return store.subscribe(render);
}
