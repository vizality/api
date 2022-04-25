/**
 * Fetch the Vizality FAQ items from a markdown file, and parse it as JSON and output
 * it in an easy usable JSON format. This makes it easy to use for the bot and other
 * use-cases.
 */
import MarkdownIt from 'markdown-it';
import fetch from 'node-fetch';
import Cors from 'cors';

/**
 * Initialize the cors middleware.
 */
const cors = Cors({
  methods: [ 'GET', 'HEAD' ]
});

/**
 * Helper method to wait for a middleware to execute before continuing.
 * And to throw an error when an error happens in a middleware.
 * @param {Request} req The request object.
 * @param {Response} res The response object.
 * @param {Function} fn The middleware function to execute.
 * @returns {Promise}
 */
function runMiddleware (req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, result => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

/**
 * Handles the request.
 * @param {Request} req The request object.
 * @param {Response} res The response object.
 * @returns {Promise<void>}
 */
export default async function handler (req, res) {
  try {
    /**
     * Run the middleware.
     */
    await runMiddleware(req, res, cors);

    /**
     * Fetch the FAQ markdown document.
     */
    const response = await fetch(`https://raw.githubusercontent.com/vizality/website/stable/FAQ.md`).catch(() => void 0);

    /**
     * Check for an ok response.
     */
    if (!response?.ok) {
      res.setHeader('cache-control', 'public, max-age=3600, must-revalidate');
      return res.status(404).json({
        message: 'FAQ Source Not Found'
      });
    }

    /**
     * Cache for 12 hours.
     */
    res.setHeader('Cache-Control', 'public, max-age=43200, must-revalidate');

    const data = await response.text();

    const output = {
      data: []
    };

    /**
     * Convert the markdown text into an object.
     */
    const md = new MarkdownIt();
    const result = md.parse(data);

    /**
     * Iterate through the markdown object and find and store the indexes for each of
     * the categories. We will use this below to associate questions (and answers) with
     * the correct categories.
     */
    const categoryIndexes = [];
    result.forEach((item, index) => {
      if (index !== 0 && item.type === 'heading_open' && item.markup === '##' && result[index + 1].content !== 'Table of Contents') {
        categoryIndexes.push(index);
      }
    });

    /**
     * Iterate through the results again.
     */
    result.forEach((item, index) => {
      /**
       * If it's a level 2 heading, and not the Table of Contents, proceed
       */
      if (index !== 0 && item.type === 'heading_open' && item.markup === '##' && result[index + 1].content !== 'Table of Contents') {
        const dataItem = {
          category: result[index + 1].content,
          items: []
        };

        /**
         * Iterate through the results yet again.
         */
        result.forEach((itm, i) => {
          /**
           * If it's a level 3 heading, assume it's a question item, and then check this
           * loop's index with the outer loop's index, to determine which category the
           * question belongs with.
           */
          if (itm.type === 'heading_open' && itm.markup === '###' && i > index + 1 && (i < categoryIndexes[categoryIndexes.indexOf(index) + 1] || (!categoryIndexes[categoryIndexes.indexOf(index) + 1] && i <= result.length - 1))) {
            /**
             * Get the question number, including the period.
             */
            const numberWithPeriod = result[i + 1].content.match(/(\d+. )/)[0];
            const number = Number(numberWithPeriod.replace('. ', ''));

            /**
             * Make the question number, question, and answer an object, and push that into
             * the appropriate category's items.
             */
            dataItem.items.push({
              number,
              question: result[i + 1].content.replace(numberWithPeriod, ''),
              answer: result[i + 4].content
            });
          }
        });
        output.data.push(dataItem);
      }
    });

    return res.status(500).json(output);
  } catch (err) {
    return res.status(500).json({
      message: 'Server Error'
    });
  }
}

