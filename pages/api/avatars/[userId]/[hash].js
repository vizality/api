/**
 * Fetch the user's avatar at a specific hash, converts it to a buffer, and returns it.
 * If the user's avatar at the specific hash isn't found (it gets deleted from Discord's server
 * eventually, after the user changes their avatar), it will fetch the current latest avatar, and cache
 * that instead. In essence, this should always return a valid image, assuming the user ID is correct.
 * It is cached for one year.
 */

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

    const { userId } = req.query;
    const hash = req.query.hash.split('.')[0];

    /**
     * Make sure a user ID is provided.
     */
    if (userId) {
      /**
       * Fetch the endpoint and convert it to an image buffer.
       */
      let response;
      response = await fetch(`https://cdn.discordapp.com/avatars/${userId}/${hash}.gif?size=512`).catch(() => void 0);
      if (!response?.ok) {
        response = await fetch(`https://cdn.discordapp.com/avatars/${userId}/${hash}.png?size=512`).catch(() => void 0);
        if (!response?.ok) {
          response = await fetch(`https://api.vizality.com/avatars/${userId}`);
          /**
           * If all else fails and there isn't an "ok" response, let's assume the provided user ID is incorrect.
           */
          if (!response?.ok) {
            /**
             * Set the response headers.
             */
            res.setHeader('content-type', 'application/json');
            res.setHeader('cache-control', 'public, max-age=3600, must-revalidate');

            return res.status(404).send({
              message: 'User Not Found',
              documentation_url: 'https://docs.vizality.com/rest/reference/users#get-a-user'
            });
          }
        }
      }

      /**
       * Convert the response into an image buffer.
       */
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      /**
       * Set the response headers.
       */
      res.setHeader('content-type', response.headers.get('content-type'));
      res.setHeader('content-length', response.headers.get('content-length'));
      res.setHeader('cache-control', 'public, max-age=31536000, must-revalidate');

      return res.send(buffer);
    }
  } catch (err) {
    return res.status(500).json({
      message: 'Server Error'
    });
  }
}

