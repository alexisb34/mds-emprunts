// js/admin/views/dashboard.js — tableau de bord : KPI, retards, remises du jour, signalements, journal.
import { store } from '../../store.js';
import { now, isWeekday } from '../../rules.js';
import { recentLog, ACTION_LABELS } from '../../log.js';
import { navigate } from '../../router.js';
import { auth } from '../../auth.js';
import { escapeHtml, badge, avatar, formatDate, formatTime, formatDateTime, relativeDay, formatSlots, fullName, toast, openModal } from '../../ui.js';
import { setDemoClock, resetDemoData, toDatetimeLocal, fromDatetimeLocal, officeStatus } from '../../actions/settings.js';
import { setTopbar } from '../layout.js';
import { openHandoverModal } from '../handoverModal.js';
import { computeKpis, lateLoans, dueTodayReservations, openReports, exitMissingRows } from '../kpi.js';

// Prochain jour ouvré à 9h (aujourd’hui si c’est un jour ouvré avant 9h).
function nextOpenDay(date) {
  const d = new Date(date);
  d.setHours(9, 0, 0, 0);
  if (d <= date) d.setDate(d.getDate() + 1);
  while (!isWeekday(d)) d.setDate(d.getDate() + 1);
  return d;
}

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
      <button type="button" class="btn btn--primary btn--sm" data-action="handover">Remettre</button>
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

// Horloge de démonstration : décale le « maintenant » de toute l’application (les deux interfaces
// partagent le même store), pour montrer un retard, une expiration ou un jour ouvré.
export function demoClockHtml({ date, horlogeDemo, status }) {
  return `
    <div class="card demo-clock">
      <div class="card__header">
        <h2 class="card__title">Horloge de démonstration</h2>
        ${horlogeDemo ? badge('derived', 'horloge_demo') : badge('derived', 'temps_reel')}
      </div>
      <p class="body-sm text-secondary">Maintenant : <strong>${escapeHtml(formatDateTime(date))}</strong></p>
      <div class="alert alert--${status.open ? 'info' : 'warning'}">${escapeHtml(status.text)}</div>
      <div class="demo-clock__row">
        <label class="field"><span class="field__label">Date et heure simulées</span><input class="input" type="datetime-local" name="horloge" value="${escapeHtml(toDatetimeLocal(date))}"></label>
        <button type="button" class="btn btn--primary" data-action="set-clock">Appliquer</button>
        <button type="button" class="btn btn--ghost" data-action="next-open" title="Prochain jour ouvré à 9h">Jour ouvré 9h</button>
        <button type="button" class="btn btn--ghost" data-action="real-clock"${horlogeDemo ? '' : ' disabled'}>Temps réel</button>
        <button type="button" class="btn btn--secondary" data-action="reset-demo" title="Recharge l’inventaire et les emprunts autour de la date ci-dessus">Régénérer les données</button>
      </div>
      <p class="body-tiny text-secondary">Les emprunts du jeu de démonstration sont calés sur la date de génération : après un grand saut dans le temps, régénérez les données pour retrouver un état cohérent.</p>
    </div>`;
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
    container.querySelectorAll('[data-action="handover"]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); openHandoverModal({}); }));
    const apply = (value) => {
      try {
        setDemoClock(value, auth.currentUserId());
        toast(value ? 'Horloge de démo appliquée' : 'Retour au temps réel', 'success');
      } catch (e) {
        toast(e.message, 'error');
      }
    };
    container.querySelector('[data-action="set-clock"]').addEventListener('click', () => {
      const value = fromDatetimeLocal(container.querySelector('[name="horloge"]').value);
      if (!value) { toast('Date invalide.', 'error'); return; }
      apply(value);
    });
    container.querySelector('[data-action="next-open"]').addEventListener('click', () => apply(nextOpenDay(date)));
    container.querySelector('[data-action="real-clock"]').addEventListener('click', () => apply(null));
    container.querySelector('[data-action="reset-demo"]').addEventListener('click', () => {
      const value = fromDatetimeLocal(container.querySelector('[name="horloge"]').value);
      openModal({
        title: 'Régénérer les données de démonstration',
        body: `<p class="body-sm">L’inventaire, les emprunts, les réservations et le journal seront remplacés par un jeu neuf calé sur le ${escapeHtml(formatDateTime(value || date))}. Les photos prises pendant la démonstration seront perdues.</p>`,
        actions: [
          { label: 'Annuler', variant: 'ghost' },
          { label: 'Régénérer', variant: 'danger', onClick: () => {
            try {
              resetDemoData(value, auth.currentUserId());
              toast('Données de démonstration régénérées', 'success');
            } catch (e) {
              toast(e.message, 'error');
              return false;
            }
          } },
        ],
      });
    });
  };
  render();
  return store.subscribe(render);
}
