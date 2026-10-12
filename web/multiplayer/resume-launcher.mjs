import {engineWorldContext} from './navigation.mjs';
import {selectedProfile} from '../campaign/progress.mjs';
import {prepareResume} from './resume-checkpoint.mjs';
import {settings, invitationURL, gameURL} from './invitation.mjs';

const status = document.getElementById('status'), button = document.getElementById('prepare');
let context, profile;
try {
  context = engineWorldContext(location.search, location.href);
  if (!context) throw Error('Open this page from a saved co-op world.');
  const query = new URLSearchParams(location.search), regions = query.getAll('RECOMP_RESUME_REGION');
  if (regions.length !== 1) throw Error('Open this page from Save and pause in the current region.');
  const initialRegion = query.get('RECOMP_RULE_COOP_REGION');
  context = {...settings({...context, resume:'', region:regions[0]}, location.href),initialRegion};
  profile = selectedProfile(location.search);
} catch (error) { status.textContent = error.message; button.disabled = true; }
button.addEventListener('click', async () => {
  button.disabled = true; status.textContent = 'Checking the committed save and preparing its separate lobby copy…';
  document.getElementById('result').hidden = true;
  try {
    const saved = await prepareResume({context, profile});
    const selected = settings({...context, role: 'host', resume: saved.token}, location.href);
    document.getElementById('host').href = gameURL(location.href, selected, profile).href;
    document.getElementById('invitation').value = invitationURL(location.href, selected).href;
    document.getElementById('instructions').textContent = `Create room “${selected.room}”, then load checkpoint ${saved.record.revision} using Load Game → “${saved.label}”. Wait for your partner to join and choose Ready, then Start Game.`;
    document.getElementById('scope').textContent = `World ${saved.record.world}, region ${saved.record.x}, ${saved.record.y}, chapter ${saved.record.chapter}. This restores the committed checkpoint; later unsaved moves are not included. Each player chooses their own local profile.`;
    document.getElementById('result').hidden = false;
    status.textContent = 'Resume copy verified. Your existing checkpoint slots were preserved.';
  } catch (error) { status.textContent = error.message; }
  finally { button.disabled = false; }
});
