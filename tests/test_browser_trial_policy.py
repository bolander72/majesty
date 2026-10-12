import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('browser_trial_policy', Path(__file__).resolve().parents[1] / 'scripts/lib/browser_trial_policy.py')
policy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(policy)


class BrowserTrialPolicyTests(unittest.TestCase):
    def reject(self, args, now=450, stopped=False, live=True):
        return policy.command_rejection({'saveByUnix': 450}, args, now, stopped, live)

    def test_keyboard_pan_cannot_cross_save_margin(self):
        self.assertIsNone(self.reject(['press', 'ArrowUp'], now=449))
        self.assertIsNotNone(self.reject(['press', 'ArrowUp']))

    def test_mouse_and_ref_clicks_stop_too(self):
        for args in [['mouse', 'down', 'left'], ['click', '@e1'], ['eval', 'game.start()'], ['tab', 'new']]:
            with self.subTest(args=args):
                self.assertIsNotNone(self.reject(args))

    def test_only_exact_save_controls_can_mutate_after_deadline(self):
        self.assertIsNone(self.reject(['find', 'role', 'button', 'click', '--name', 'Save and pause', '--exact']))
        for name in ['Start game', 'Save and pause later']:
            self.assertIsNotNone(self.reject(['find', 'role', 'button', 'click', '--name', name, '--exact']))
        self.assertIsNotNone(self.reject(['find', 'role', 'button', 'click', '--name', 'Save and pause']))

    def test_guard_stop_allows_cleanup_only(self):
        self.assertIsNone(self.reject(['close'], stopped=True))
        self.assertIsNotNone(self.reject(['snapshot', '-i'], stopped=True))
        self.assertIsNotNone(self.reject(['get', 'text', 'body'], stopped=True))

    def test_committed_checkpoint_recovery_is_available_after_disconnect(self):
        self.assertIsNone(self.reject(['find', 'role', 'link', 'click', '--name', 'Close game and prepare resume', '--exact']))
        self.assertIsNone(self.reject(['find', 'role', 'link', 'click', '--name', 'Close game and recover checkpoint', '--exact']))
        self.assertIsNone(self.reject(['find', 'role', 'link', 'click', '--name', 'Close game and request resume invitation', '--exact']))
        self.assertIsNotNone(self.reject(['find', 'role', 'link', 'click', '--name', 'Close game and request resume invitation']))
        self.assertIsNotNone(self.reject(['find', 'role', 'link', 'click', '--name', 'Launch game', '--exact']))

    def test_dead_chrome_never_relaunches_even_for_inspection(self):
        for args in [['snapshot'], ['close'], ['press', 'ArrowUp']]:
            self.assertIsNotNone(self.reject(args, now=100, live=False))

    def test_save_export_and_tab_cleanup_remain_available(self):
        for args in [['download', '#export', '/tmp/backup.zip'], ['tab', 't1'], ['tab', 'close', 't2'], ['snapshot', '-i']]:
            self.assertIsNone(self.reject(args))
        self.assertIsNone(self.reject(['find', 'label', policy.CLOSED_GAMES_LABEL, 'check']))
        self.assertIsNotNone(self.reject(['find', 'label', 'Enable cheats', 'check']))

    def test_backup_navigation_does_not_allow_another_game_launch(self):
        trial = {'saveByUnix': 450, 'backupUrl': 'http://localhost:8000/releases/player096/backups/'}
        self.assertIsNone(policy.command_rejection(trial, ['open', trial['backupUrl']], 451, False, True))
        self.assertIsNotNone(policy.command_rejection(trial, ['open', 'http://localhost:8000/majesty/'], 451, False, True))


if __name__ == '__main__':
    unittest.main()
