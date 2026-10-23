import { AppConfig, loadConfig } from './configuration';

export class ConfigService {
  private static instance: ConfigService;
  private readonly config: AppConfig;

  constructor(envOverrides?: Partial<Record<string, string>>) {
    this.config = loadConfig({ ...process.env, ...envOverrides });
  }

  public static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  get isSandbox(): boolean {
    return this.config.SANDBOX_MODE;
  }

  get isProduction(): boolean {
    return this.config.PRODUCTION_MODE;
  }

  get requireSecondApprover(): boolean {
    return this.config.REQUIRE_SECOND_APPROVER;
  }

  get port(): number {
    return this.config.PORT;
  }

  get transferDailyLimitMinor(): number {
    return this.config.TRANSFER_DAILY_LIMIT_MINOR;
  }

  get transferTransactionLimitMinor(): number {
    return this.config.TRANSFER_TRANSACTION_LIMIT_MINOR;
  }

  get transferMfaThresholdMinor(): number {
    return this.config.TRANSFER_MFA_THRESHOLD_MINOR;
  }

  get beneficiaryCoolingOffHours(): number {
    return this.config.BENEFICIARY_COOLING_OFF_HOURS;
  }

  get transferVelocityMaxPerHour(): number {
    return this.config.TRANSFER_VELOCITY_MAX_PER_HOUR;
  }

  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }
}
