import {engineWorldContext} from './navigation.mjs';
import {selectedProfile} from '../campaign/progress.mjs';

const status = document.getElementById('context');
try {
  const context = engineWorldContext(location.search, location.href);
  if (!context) throw Error('Open this page from your disconnected shared world.');
  const profile = selectedProfile(location.search);
  document.getElementById('profile').textContent = profile
    ? `Choose your local profile “${profile}” when opening the new invitation.`
    : 'Use your existing default local profile when opening the new invitation.';
  status.textContent = `World ${context.world}, chapter ${context.chapter}. Ask the host for room “${context.room}”.`;
} catch (error) { status.textContent = error.message; }
