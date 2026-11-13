import { buildAppConfig } from '../../app.config';

describe('app.config variants and S5 blockedPermissions', () => {
  it('defaults to production Budget App configuration without release signing plugin', () => {
    const cfg = buildAppConfig({}, {});
    expect(cfg.name).toBe('Budget App');
    expect(cfg.scheme).toBe('budgetapp');
    expect(cfg.icon).toBe('./assets/images/icon.png');
    expect(cfg.android?.package).toBe('com.hamim.budgetapp');
    expect(cfg.android?.blockedPermissions).toEqual(
      expect.arrayContaining([
        'android.permission.SYSTEM_ALERT_WINDOW',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
      ])
    );
    expect(cfg.plugins).not.toContain('./plugins/withReleaseSigning');
  });

  it('switches package, app name, scheme, and icons cleanly when APP_VARIANT=dev', () => {
    const cfg = buildAppConfig({}, { appVariant: 'dev' });
    expect(cfg.name).toBe('Budget Dev');
    expect(cfg.scheme).toBe('budgetapp-dev');
    expect(cfg.icon).toBe('./assets/images/icon-dev.png');
    expect(cfg.android?.package).toBe('com.hamim.budgetapp.dev');
    expect(cfg.android?.adaptiveIcon?.backgroundColor).toBe('#DCFCE7');
    expect(cfg.android?.adaptiveIcon?.foregroundImage).toBe(
      './assets/images/android-icon-foreground-dev.png'
    );
    expect(cfg.android?.adaptiveIcon?.backgroundImage).toBe(
      './assets/images/android-icon-background-dev.png'
    );
    expect(cfg.plugins).not.toContain('./plugins/withReleaseSigning');
  });

  it('activates withReleaseSigning plugin ONLY when BUDGET_RELEASE_SIGNING=new', () => {
    const cfg = buildAppConfig({}, { releaseSigning: 'new' });
    expect(cfg.android?.package).toBe('com.hamim.budgetapp');
    expect(cfg.plugins).toContain('./plugins/withReleaseSigning');
  });
});
