import { Request, Response } from 'express';
import { CountriesService } from './countries.service';

export class CountriesController {
  constructor(private readonly countriesService: CountriesService = new CountriesService()) {}

  /**
   * GET /countries
   * Returns list of supported countries for membership onboarding, accepted ID types,
   * currencies, and lending product flags.
   */
  getCountries = async (req: Request, res: Response) => {
    const includeSanctioned = req.query.includeSanctioned === 'true';
    const countries = await this.countriesService.findAll(includeSanctioned);
    res.json(countries);
  };

  /**
   * GET /countries/:code
   */
  getCountryByCode = async (req: Request, res: Response) => {
    const { code } = req.params;
    const country = await this.countriesService.findByCode(code);
    if (!country) {
      res.status(404).json({
        statusCode: 404,
        message: `Country code '${code}' not found.`,
      });
      return;
    }
    res.json(country);
  };

  /**
   * GET /countries/:code/sanction-check
   */
  checkSanction = async (req: Request, res: Response) => {
    const { code } = req.params;
    const result = await this.countriesService.checkSanction(code);
    res.json(result);
  };
}
