import { Source } from 'modjules/types';

export const sources: Source[] = [
  {
    name: 'sources/github/modjules/jules-sdk',
    id: 'github/modjules/jules-sdk',
    type: 'githubRepo',
    githubRepo: {
      owner: 'modjules',
      repo: 'jules-sdk',
      isPrivate: false,
    },
  },
  {
    name: 'sources/github/my-org/secret-project',
    id: 'github/my-org/secret-project',
    type: 'githubRepo',
    githubRepo: {
      owner: 'my-org',
      repo: 'secret-project',
      isPrivate: true,
    },
  },
];
