/**
 * Fetch the user's current avatar, converts it to a buffer, and returns it.
 * This can be used to always get the user's current avatar. It is cached for one hour.
 * @description
 */

import { fetchUser } from '#discord';
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
    const user = await fetchUser(userId);

    /**
     * Check if a user is found.
     */
    if (user) {
      let endpoint;

      /**
       * Check if the user has a custom avatar.
       */
      if (user.avatar) {
        const extension = user.avatar.startsWith('a_') ? 'gif' : 'png';
        endpoint = `https://cdn.discordapp.com/avatars/${userId}/${user.avatar}.${extension}?size=512`;

      /**
       * If they don't have a custom avatar, determine what default to use based on their discriminator.
       */
      } else {
        endpoint = `https://cdn.discordapp.com/embed/avatars/${user.discriminator % 5}.png`;
      }

      /**
       * Fetch the endpoint and convert it to an image buffer.
       */
      const response = await fetch(endpoint);

      /**
       * If there isn't an "ok" response, let's assume the provided user ID is incorrect.
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
      res.setHeader('cache-control', 'public, max-age=3600, must-revalidate');

      return res.send(buffer);
    }

    return res.status(404).send({
      message: 'Not Found',
      documentation_url: 'https://docs.vizality.com/rest/reference/users#get-a-user'
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Server Error'
    });
  }
}
