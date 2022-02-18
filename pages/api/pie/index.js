import { createOAuthAppAuth } from '@octokit/auth-oauth-app';
import { Octokit } from '@octokit/rest';
import Cors from 'cors';

const github = new Octokit({
  authStrategy: createOAuthAppAuth,
  auth: {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET
  }
});

// Initializing the cors middleware
const cors = Cors({
  methods: [ 'GET', 'HEAD' ]
});

/*
 * Helper method to wait for a middleware to execute before continuing
 * And to throw an error when an error happens in a middleware
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
 * Gets all of the addon repos currently active on the addon community repo.
 * @private
 */
export const generateAddonsList = async () => {
  const addons = {
    plugins: [],
    themes: []
  };

  const repo = await github.rest.repos.getContent({
    owner: 'vizality',
    repo: 'community',
    path: 'plugins'
  });

  console.log(repo);

  return repo;
};

export default async function handler (req, res) {
  const addons = await generateAddonsList();

  /**
   * Run the middleware.
   */
  await runMiddleware(req, res, cors);

  res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');

  return res.status(200).json({ addons });
}
