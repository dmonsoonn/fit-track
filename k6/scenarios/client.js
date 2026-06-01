import { get, post } from '../lib/api.js';
import { sleep } from 'k6';

function todayDate() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

// Simulates a client checking their schedule, food diary, and adding a food entry.
export function clientScenario(data) {
  const tags = { scenario: 'client' };
  const date = todayDate();

  // View training schedule
  get(data.clientToken, '/clients/me/schedule', tags);

  // View active workout plan
  get(data.clientToken, '/clients/me/plans', tags);

  // View today's food log
  get(data.clientToken, `/clients/me/food-logs/${date}`, tags);

  // Add a food entry (write operation — exercises the write path)
  post(
    data.clientToken,
    `/clients/me/food-logs/${date}/entries`,
    {
      title: 'k6 test meal',
      description: 'load test entry',
      calories: 400,
      protein: 30,
      fat: 10,
      carbs: 50,
    },
    tags,
  );

  // Check notifications
  get(data.clientToken, '/notifications', tags);

  sleep(2);
}
