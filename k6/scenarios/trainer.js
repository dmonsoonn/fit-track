import { get, parseData } from '../lib/api.js';
import { sleep } from 'k6';

// Simulates a trainer browsing their dashboard: clients, plans, notifications, exercises.
export function trainerScenario(data) {
  const tags = { scenario: 'trainer' };

  // List clients
  get(data.trainerToken, '/trainer/clients', tags);

  // View specific client detail
  get(data.trainerToken, `/trainer/clients/${data.clientId}`, tags);

  // List workout plans for the client
  const plansRes = get(
    data.trainerToken,
    `/trainer/clients/${data.clientId}/plans`,
    tags,
  );
  const plans = parseData(plansRes);
  if (plans && plans.length > 0) {
    get(
      data.trainerToken,
      `/trainer/clients/${data.clientId}/plans/${plans[0].workout_plan_id}`,
      tags,
    );
  }

  // Check notifications
  get(data.trainerToken, '/notifications', tags);

  // Browse exercise catalogue
  get(data.trainerToken, '/exercises', tags);

  sleep(2);
}
