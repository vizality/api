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
    for (const [ index, item ] of result.entries()) {
      if (item.type === 'heading_open' && item.tag === 'h2' && result[index + 1].content !== 'Table of Contents') {
        categoryIndexes.push(index);
      }
    }

    /**
     * Iterate through the results again.
     */
    for (const [ index, item ] of result.entries()) {
      /**
       * If it's a level 2 heading, and not the Table of Contents, proceed
       */
      if (item.type === 'heading_open' && item.tag === 'h2' && result[index + 1].content !== 'Table of Contents') {
        const dataItem = {
          category: result[index + 1].content,
          items: []
        };

        /**
         * Iterate through the results yet again.
         */
        for (const [ i, itm ] of result.entries()) {
          /**
           * If it's a level 3 heading, assume it's a question item, and then check this
           * loop's index with the outer loop's index, to determine which category the
           * question belongs with, making sure the child index is between the index of
           * the current category and the next categpry. If no next category index is found,
           * assume the current category is the last category and use the length of the
           * results array instead.
           */
          if (itm.type === 'heading_open' && itm.tag === 'h3' && i > index + 1 && (i < categoryIndexes[categoryIndexes.indexOf(index) + 1] || (!categoryIndexes[categoryIndexes.indexOf(index) + 1] && i <= result.length - 1))) {
            /**
             * Get the question number, including the period.
             */
            const numberWithPeriodAndSpace = result[i + 1].content.match(/(\d+. )/)[0];
            const number = Number(numberWithPeriodAndSpace.replace('. ', ''));

            /**
             * Make the question number, question, and answer an object, and push that into
             * the appropriate category's items.
             */
            dataItem.items.push({
              number,
              question: result[i + 1].content.replace(numberWithPeriodAndSpace, ''),
              answer: result[i + 4].content
            });
          }
        }

        output.data.push(dataItem);
      }
    }

    if (output.length) {
      return output;
    }

    return res.status(500).json(output);
  } catch (err) {
    return res.status(500).json({
      message: 'Server Error'
    });
  }
}

