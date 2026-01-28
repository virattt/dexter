/**
 * Type declarations for lunar-javascript
 * @see https://github.com/6tail/lunar-javascript
 */

declare module 'lunar-javascript' {
  export class Solar {
    static fromYmd(year: number, month: number, day: number): Solar;
    getLunar(): Lunar;
    getYear(): number;
    getMonth(): number;
    getDay(): number;
  }

  export class Lunar {
    getEightChar(): EightChar;
    getYearGan(): string;
    getYearZhi(): string;
    getYearGanExact(): string;
    getYearZhiExact(): string;
    getMonthGan(): string;
    getMonthZhi(): string;
    getDayGan(): string;
    getDayZhi(): string;
    getTimeGan(): string;
    getTimeZhi(): string;
    getYear(): number;
    getMonth(): number;
    getDay(): number;
  }

  export class EightChar {
    static fromLunar(lunar: Lunar): EightChar;
    getYear(): string;
    getMonth(): string;
    getDay(): string;
    getTime(): string;
    getYearGan(): string;
    getYearZhi(): string;
    getMonthGan(): string;
    getMonthZhi(): string;
    getDayGan(): string;
    getDayZhi(): string;
    getTimeGan(): string;
    getTimeZhi(): string;
  }

  export class LunarUtil {
    static WU_XING_GAN: Record<string, string>;
    static WU_XING_ZHI: Record<string, string>;
  }
}
