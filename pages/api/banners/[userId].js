/**
 * Fetch the user's current banner, converts it to a buffer, and returns it.
 * This can be used to always get the user's current banner. It is cached for one hour.
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

    /**
     * Split the end of the URL by . and use the portion before. This enables you to link
     * the route with .gif added, for instance, which is parsed by Discord to show as an
     * animated GIF in chat.
     */
    const userId = req.query.userId.split('.')[0];

    const user = await fetchUser(userId);
    /**
     * Check if a user is found.
     */
    if (user) {
      let endpoint;
      /**
       * Check if the user has a custom banner.
       */
      if (user.banner) {
        const extension = user.banner.startsWith('a_') ? 'gif' : 'png';
        endpoint = `https://cdn.discordapp.com/banners/${userId}/${user.banner}.${extension}?size=600`;
      /**
       * Check if there's a banner color.
       */
      } else if (user.banner_color) {
        endpoint = `https://singlecolorimage.com/get/${user.banner_color.substring(1)}/600x120`;
      /**
       * @todo No good solution for this yet. Need to get the average color from
       * the bot's avatar image.
       */
      } else if (user.bot) {

      /**
       * If there's no banner image, the banner color is null, and it's not a bot,
       * it's using the default Discord color, #d2d2d2.
       */
      } else {
        endpoint = `https://singlecolorimage.com/get/d2d2d2/600x120`;
      }

      /**
       * Fetch the endpoint and convert it to an image buffer.
       */
      const response = await fetch(endpoint);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      /**
       * Set the response headers.
       */
      res.setHeader('Content-Type', response.headers.get('content-type'));
      res.setHeader('Content-Length', response.headers.get('content-length'));
      res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');

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
