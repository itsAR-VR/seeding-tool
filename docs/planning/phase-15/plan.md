# Phase 15 — Unified Influencer Discovery, Social-Graph Expansion, and Source-Normalized Enrichment

## Original User Request (verbatim)
okay, so Collabster and the categories of the influencers that we get from there should be synchronized with the stuff that we're getting from the apify, because essentially we want to search the same terms and we want to be able to get influencers from both lists. maybe we have a small model inferring the niche from the bio and pulled information that we should have from the collabster scrape. Okay, or we can just select both items within the actual search UI, specifying different sources of where we got the leads from, making them both required, and then having them work towards that limit that we set. 

A part of this $phase-plan  to make the overall process for influencer identification better, I'm going to attach the current process at the end. 

Use these APIs in order to actually have this process work a lot better. I'm sure you can reason and figure out the best way to use them as well. Ask me the questions if you need it. "{
  "openapi": "3.0.1",
  "info": {
    "title": "Mass Instagram Email Scraper",
    "description": "[𝗖𝗵𝗲𝗮𝗽𝗲𝘀𝘁 𝗣𝗿𝗶𝗰𝗲] The Mass/Bulk Instagram Email Scraper efficiently extracts email addresses from Instagram profiles based on custom keywords. Ideal for influencer marketing, social outreach, and business collaborations. Fast, accurate, and 50% more affordable than competitors.",
    "version": "0.1",
    "x-build-id": "mTLd9baHzWle6nG9Q"
  },
  "servers": [
    {
      "url": "https://api.apify.com/v2"
    }
  ],
  "paths": {
    "/acts/scraper-mind~instagram-email-scraper/run-sync-get-dataset-items": {
      "post": {
        "operationId": "run-sync-get-dataset-items-scraper-mind-instagram-email-scraper",
        "x-openai-isConsequential": false,
        "summary": "Executes an Actor, waits for its completion, and returns Actor's dataset items in response.",
        "tags": [
          "Run Actor"
        ],
        "requestBody": {
          "required": true,
         "application/json": {
              "schema": {
                "$ref": "#/components/schemas/inputSchema"
              }
            }
          }
        },
        "parameters": [
          {
            "name": "token",
            "in": "query",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "Enter your Apify token here"
          }
        ],
        "responses": {
          "200": {
            "description": "OK"
          }
        }
      }
    },
    "/acts/scraper-mind~instagram-email-scraper/runs": {
      "post": {
        "operationId": "runs-sync-scraper-mind-instagram-email-scraper",
        "x-openai-isConsequential": false,
        "summary": "Executes an Actor and returns information about the initiated run in response.",
        "tags": [
          "Run Actor"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/inputSchema"
              }
            }
          }
        },
        "parameters": [
          {
            "name": "token",
            "in": "query",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "Enter your Apify token here"
          }
        ],
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/runsResponseSchema"
                }
              }
            }
          }
        }
      }
    },
    "/acts/scraper-mind~instagram-email-scraper/run-sync": {
      "post": {
        "operationId": "run-sync-scraper-mind-instagram-email-scraper",
        "x-openai-isConsequential": false,
        "summary": "Executes an Actor, waits for completion, and returns the OUTPUT from Key-value store in response.",
        "tags": [
          "Run Actor"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/inputSchema"
              }
            }
          }
        },
        "parameters": [
          {
            "name": "token",
            "in": "query",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "Enter your Apify token here"
          }
        ],
        "responses": {
          "200": {
            "description": "OK"
          }
        }
      }
    }
  },
  "components": {
    "schemas": {
      "inputSchema": {
        "type": "object",
        "required": [
          "keywords"
        ],
        "properties": {
          "keywords": {
            "title": "Keywords",
            "type": "array",
            "description": "A list of keywords to search for.",
            "default": [
              "founder",
              "marketing"
            ],
            "items": {
              "type": "string"
            }
          },
          "location": {
            "title": "Location",
            "type": "string",
            "description": "Location to filter search results.",
            "default": ""
          },
          "platform": {
            "title": "Platform",
            "enum": [
              "Instagram"
            ],
            "type": "string",
            "description": "Select platform.",
            "default": "Instagram"
          },
          "customDomains": {
            "title": "Custom Email Domains",
            "type": "array",
            "description": "List of custom email domains",
            "default": [
              "@gmail.com"
            ],
            "items": {
              "type": "string"
            }
          },
          "maxEmails": {
            "title": "Max Emails",
            "minimum": 1,
            "maximum": 10000,
            "type": "integer",
            "description": "Maximum number of emails to collect. The scraper will stop once this limit is reached. Setting a higher limit allows for more potential results but doesn't guarantee reaching that number. This helps save costs by controlling scraping time.",
            "default": 20
          },
          "engine": {
            "title": "Engine",
            "enum": [
              "cost-effective",
              "legacy"
            ],
            "type": "string",
            "description": "Choose scraping engine. 🚀 Cost Effective (New): Uses residential proxies with async requests for faster, cheaper scraping. 🔧 Legacy: Uses GOOGLE_SERP proxy with traditional selectors - more reliable but slower and more expensive.",
            "default": "legacy"
          },
          "proxyConfiguration": {
            "title": "Proxy Configuration",
            "type": "object",
            "description": "Configure proxies for this Actor."
          }
        }
      },
      "responseSchema": {
        "type": "object",
        "properties": {
          "data": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string"
              },
              "actId": {
                "type": "string"
              },
              "userId": {
                "type": "string"
              },
              "startedAt": {
                "type": "string",
                "format": "date-time",
                "example": "2025-01-08T00:00:00.000Z"
              },
              "finishedAt": {
                "type": "string",
                "format": "date-time",
                "example": "2025-01-08T00:00:00.000Z"
              },
              "status": {
                "type": "string",
                "example": "READY"
              },
              "meta": {
                "type": "object",
                "properties": {
                  "origin": {
                    "type": "string",
                    "example": "API"
                  },
                  "userAgent": {
                    "type": "string"
                  }
                }
              },
              "stats": {
                "type": "object",
                "properties": {
                  "inputBodyLen": {
                    "type": "integer",
                    "example": 2000
                  },
                  "rebootCount": {
                    "type": "integer",
                    "example": 0
                  },
                  "restartCount": {
                    "type": "integer",
                    "example": 0
                  },
                  "resurrectCount": {
                    "type": "integer",
                    "example": 0
                  },
                  "computeUnits": {
                    "type": "integer",
                    "example": 0
                  }
                }
              },
              "options": {
                "type": "object",
                "properties": {
                  "build": {
                    "type": "string",
                    "example": "latest"
                  },
                  "timeoutSecs": {
                    "type": "integer",
                    "example": 300
                  },
                  "memoryMbytes": {
                    "type": "integer",
                    "example": 1024
                  },
                  "diskMbytes": {
                    "type": "integer",
                    "example": 2048
                  }
                }
              },
              "buildId": {
                "type": "string"
              },
              "defaultKeyValueStoreId": {
                "type": "string"
              },
              "defaultDatasetId": {
                "type": "string"
              },
              "defaultRequestQueueId": {
                "type": "string"
              },
              "buildNumber": {
                "type": "string",
                "example": "1.0.0"
              },
              "containerUrl": {
                "type": "string"
              },
              "usage": {
                "type": "object",
                "properties": {
                  "ACTOR_COMPUTE_UNITS": {
                    "type": "integer",
                    "example": 0
                  },
                  "DATASET_READS": {
                    "type": "integer",
                    "example": 0
                  },
                  "DATASET_WRITES": {
                    "type": "integer",
                    "example": 0
                  },
                  "KEY_VALUE_STORE_READS": {
                    "type": "integer",
                    "example": 0
                  },
                  "KEY_VALUE_STORE_WRITES": {
                    "type": "integer",
                    "example": 1
                  },
                  "KEY_VALUE_STORE_LISTS": {
                    "type": "integer",
                    "example": 0
                  },
                  "REQUEST_QUEUE_READS": {
                    "type": "integer",
                    "example": 0
                  },
                  "REQUEST_QUEUE_WRITES": {
                    "type": "integer",
                    "example": 0
                  },
                  "DATA_TRANSFER_INTERNAL_GBYTES": {
                    "type": "integer",
                    "example": 0
                  },
                  "DATA_TRANSFER_EXTERNAL_GBYTES": {
                    "type": "integer",
                    "example": 0
                  },
                  "PROXY_RESIDENTIAL_TRANSFER_GBYTES": {
                    "type": "integer",
                    "example": 0
                  },
                  "PROXY_SERPS": {
                    "type": "integer",
                    "example": 0
                  }
                }
              },
              "usageTotalUsd": {
                "type": "number",
                "example": 0.00005
              },
              "usageUsd": {
                "type": "object",
                "properties": {
                  "ACTOR_COMPUTE_UNITS": {
                    "type": "integer",
                    "example": 0
                  },
                  "DATASET_READS": {
                    "type": "integer",
                    "example": 0
                  },
                  "DATASET_WRITES": {
                    "type": "integer",
                    "example": 0
                  },
                  "KEY_VALUE_STORE_READS": {
                    "type": "integer",
                    "example": 0
                  },
                  "KEY_VALUE_STORE_WRITES": {
                    "type": "number",
                    "example": 0.00005
                  },
                  "KEY_VALUE_STORE_LISTS": {
                    "type": "integer",
                    "example": 0
                  },
                  "REQUEST_QUEUE_READS": {
                    "type": "integer",
                    "example": 0
                  },
                  "REQUEST_QUEUE_WRITES": {
                    "type": "integer",
                    "example": 0
                  },
                  "DATA_TRANSFER_INTERNAL_GBYTES": {
                    "type": "integer",
                    "example": 0
                  },
                  "DATA_TRANSFER_EXTERNAL_GBYTES": {
                    "type": "integer",
                    "example": 0
                  },
                  "PROXY_RESIDENTIAL_TRANSFER_GBYTES": {
                    "type": "integer",
                    "example": 0
                  },
                  "PROXY_SERPS": {
                    "type": "integer",
                    "example": 0
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}" "{
  "openapi": "3.0.1",
  "info": {
    "title": "Instagram Search Scraper",
    "description": "Scrape Instagram search results: places, businesses, locations, users, and hashtags. Add a keyword and extract search results like contact details, categories, metrics, recent posts, hashtag popularity. Export scraped data, schedule scraper via API, and integrate with other tools or AI workflows.",
    "version": "0.1",
    "x-build-id": "hIfkT20Tel2kuAuKG"
  },
  "servers": [
    {
      "url": "https://api.apify.com/v2"
    }
  ],
  "paths": {
    "/acts/apify~instagram-search-scraper/run-sync-get-dataset-items": {
      "post": {
        "operationId": "run-sync-get-dataset-items-apify-instagram-search-scraper",
        "x-openai-isConsequential": false,
        "summary": "Executes an Actor, waits for its completion, and returns Actor's dataset items in response.",
        "tags": [
          "Run Actor"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/inputSchema"
              }
            }
          }
        },
        "parameters": [
          {
            "name": "token",
            "in": "query",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "Enter your Apify token here"
          }
        ],
        "responses": {
          "200": {
            "description": "OK"
          }
        }
      }
    },
    "/acts/apify~instagram-search-scraper/runs": {
      "post": {
        "operationId": "runs-sync-apify-instagram-search-scraper",
        "x-openai-isConsequential": false,
        "summary": "Executes an Actor and returns information about the initiated run in response.",
        "tags": [
          "Run Actor"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/inputSchema"
              }
            }
          }
        },
        "parameters": [
          {
            "name": "token",
            "in": "query",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "Enter your Apify token here"
          }
        ],
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/runsResponseSchema"
                }
              }
            }
          }
        }
      }
    },
    "/acts/apify~instagram-search-scraper/run-sync": {
      "post": {
        "operationId": "run-sync-apify-instagram-search-scraper",
        "x-openai-isConsequential": false,
        "summary": "Executes an Actor, waits for completion, and returns the OUTPUT from Key-value store in response.",
        "tags": [
          "Run Actor"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/inputSchema"
              }
            }
          }
        },
        "parameters": [
          {
            "name": "token",
            "in": "query",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "Enter your Apify token here"
          }
        ],
        "responses": {
          "200": {
            "description": "OK"
          }
        }
      }
    }
  },
  "components": {
    "schemas": {
      "inputSchema": {
        "type": "object",
        "required": [
          "search"
        ],
        "properties": {
          "search": {
            "title": "🔍 Search term",
            "pattern": "^[^!?.,:;\\-+=*&%$#@/\\~^|<>()[\\]{}\"'`]+(?:,[^!?.,:;\\-+=*&%$#@/\\~^|<>()[\\]{}\"'`]+)*$",
            "type": "string",
          "description": "Provide a keyword which will be used to extract Instagram search results. A keyword may consist of one or multiple words. To scrape multiple search terms at once, just submit them as a comma-separated list.",
            "default": "restaurant, restaurant prague"
          },
          "searchType": {
            "title": "🧚 Search type",
            "enum": [
              "place",
              "user",
              "hashtag"
            ],
            "type": "string",
            "description": "Choose the type of Instagram pages to search for (you can look for hashtags, profiles or places).",
            "default": "place"
          },
          "searchLimit": {
            "title": "💯 Maximum results per search term",
            "minimum": 1,
            "maximum": 250,
            "type": "integer",
            "description": "Set the maximum number of search results (hashtags, users, or places) you want to scrape. If you set it  to 5, you'll get 5 results for each seaterm you've included."
          },
          "enhanceUserSearchWithFacebookPage": {
            "title": "Enhance the user search (top 10) with Facebook page & email information - if available (higher credit usage)",
            "type": "boolean",
            "description": "For each user from the top 10, the scraper will extract their Facebook page that sometimes contains their business email. Please keep in mind that you are forbidden to collect personal data in certain jurisdictions. Please see <a href=\"https://blog.apify.com/is-web-scraping-legal/#think-twice-before-scraping-personal-data\">this article</a> for more details."
          }
        }
      },
      "runsResponseSchema": {
        "type": "object",
        "properties": {
          "data": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string"
              },
              "actId": {
                "type": "string"
              },
              "userId": {
                "type": "string"
              },
              "startedAt": {
                "type": "string",
                "format": "date-time",
                "example": "2025-01-08T00:00:00.000Z"
              },
              "finishedAt": {
                "type": "string",
                "format": "date-time",
                "example": "2025-01-08T00:00:00.000Z"
              },
              "status": {
                "type": "string",
                "example": "READY"
              },
              "meta": {
                "type": "object",
                "properties": {
                  "origin": {
                    "type": "string",
                    "example": "API"
                  },
                  "userAgent": {
                    "type": "string"
                  }
                }
              },
              "stats": {
                "type": "object",
                "properties": {
                  "inputBodyLen": {
                    "type": "integer",
                    "example": 2000
                  },
                  "rebootCount": {
                    "type": "integer",
                    "example": 0
                  },
                  "restartCount": {
                    "type": "integer",
                    "example": 0
                  },
                  "resurrectCount": {
                    "type": "integer",
                    "example": 0
                  },
                  "computeUnits": {
                    "type": "integer",
                    "example": 0
                  }
                }
              },
              "options": {
                "type": "object",
                "properties": {
                  "build": {
                    "type": "string",
                    "example": "latest"
                  },
                  "timeoutSecs": {
                    "type": "integer",
                    "example": 300
                  },
                  "memoryMbytes": {
                    "type": "integer",
                    "example": 1024
                  },
                  "diskMbytes": {
                    "type": "integer",
                    "example": 2048
                  }
                }
              },
              "buildId": {
                "type": "string"
              },
              "defaultKeyValueStoreId": {
                "type": "string"
              },
              "defaultDatasetId": {
                "type": "string"
              },
              "defaultRequestQueueId": {
                "type": "string"
              },
              "buildNumber": {
                "type": "string",
                "example": "1.0.0"
              },
              "containerUrl": {
                "type": "string"
              },
              "usage": {
                "type": "object",
                "properties": {
                  "ACTOR_COMPUTE_UNITS": {
                    "type": "integer",
                    "example": 0
                  },
                  "DATASET_READS": {
                    "type": "integer",
                    "example": 0
                  },
                  "DATASET_WRITES": {
                    "type": "integer",
                    "example": 0
                  },
                  "KEY_VALUE_STORE_READS": {
                    "type": "integer",
                    "example": 0
                  },
                  "KEY_VALUE_STORE_WRITES": {
                    "type": "integer",
                    "example": 1
                  },
                  "KEY_VALUE_STORE_LISTS": {
                    "type": "integer",
                    "example": 0
                  },
                  "REQUEST_QUEUE_READS": {
                    "type": "integer",
                    "example": 0
                  },
                  "REQUEST_QUEUE_WRITES": {
                    "type": "integer",
                    "example": 0
                  },
                  "DATA_TRANSFER_INTERNAL_GBYTES": {
                    "type": "integer",
                    "example": 0
                  },
                  "DATA_TRANSFER_EXTERNAL_GBYTES": {
                    "type": "integer",
                    "example": 0
                  },
                  "PROXY_RESIDENTIAL_TRANSFER_GBYTES": {
                    "type": "integer",
                    "example": 0
                  },
                  "PROXY_SERPS": {
                    "type": "integer",
                    "example": 0
                  }
                }
              },
              "usageTotalUsd": {
                "type": "number",
                "example": 0.00005
              },
              "usageUsd": {
                "type": "object",
                "properties": {
                  "ACTOR_COMPUTE_UNITS": {
                    "type": "integer",
                    "example": 0
                  },
                  "DATASET_READS": {
                    "type": "integer",
                    "example": 0
                  },
                  "DATASET_WRITES": {
                    "type": "integer",
                    "example": 0
                  },
                  "KEY_VALUE_STORE_READS": {
                    "type": "integer",
                    "example": 0
                  },
                  "KEY_VALUE_STORE_WRITES": {
                    "type": "number",
                    "example": 0.00005
                  },
                  "KEY_VALUE_STORE_LISTS": {
                    "type": "integer",
                    "example": 0
                  },
                  "REQUEST_QUEUE_READS": {
                    "type": "integer",
                    "example": 0
                  },
                  "REQUEST_QUEUE_WRITES": {
                    "type": "integer",
                    "example": 0
                  },
                  "DATA_TRANSFER_INTERNAL_GBYTES": {
                    "type": "integer",
                    "example": 0
                  },
                  "DATA_TRANSFER_EXTERNAL_GBYTES": {
                    "type": "integer",
                    "example": 0
                  },
                  "PROXY_RESIDENTIAL_TRANSFER_GBYTES": {
                    "type": "integer",
                    "example": 0
                  },
                  "PROXY_SERPS": {
                    "type": "integer",
                    "example": 0
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}" "{
  "openapi": "3.0.1",
  "info": {
    "title": "Instagram Profile Scraper",
    "description": "Scrape all Instagram profile info. Just add Instagram usernames, IDs or URLs and extract name, join date, number of followers,  location, bio, website, related profiles, video&post count, latest posts. Export scraped data, schedule scraper via API, and integrate with other tools or AI workflows.",
    "version": "0.0",
    "x-build-id": "AXsunGbSSF4osqaZM"
  },
  "servers": [
    {
      "url": "https://api.apify.com/v2"
    }
  ],
  "paths": {
    "/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items": {
      "post": {
        "operationId": "run-sync-get-dataset-items-apify-instagram-profile-scraper",
        "x-openai-isConsequential": false,
        "summary": "Executes an Actor, waits for its completion, and returns Actor's dataset items in response.",
        "tags": [
          "Run Actor"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/inputSchema"
              }
            }
          }
        },
        "parameters": [
          {
            "name": "token",
            "in": "query",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "Enter your Apify token here"
          }
        ],
        "responses": {
          "200": {
            "description": "OK"
          }
        }
      }
    },
    "/acts/apify~instagram-profile-scraper/runs": {
      "post": {
        "operationId": "runs-sync-apify-instagram-profile-scraper",
        "x-openai-isConsequential": false,
        "summary": "Executes an Actor and returns information about the initiated run in response.",
        "tags": [
          "Run Actor"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/inputSchema"
              }
            }
          }
        },
        "parameters": [
          {
            "name": "token",
            "in": "query",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "Enter your Apify token here"
          }
        ],
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/runsResponseSchema"
                }
              }
            }
          }
        }
      }
    },
    "/acts/apify~instagram-profile-scraper/run-sync": {
      "post": {
        "operationId": "run-sync-apify-instagram-profile-scraper",
        "x-openai-isConsequential": false,
        "summary": "Executes an Actor, waits for completion, and returns the OUTPUT from Key-value store in response.",
        "tags": [
          "Run Actor"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/inputSchema"
              }
            }
          }
        },
        "parameters": [
          {
            "name": "token",
            "in": "query",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "Enter your Apify token here"
          }
        ],
        "responses": {
          "200": {
            "description": "OK"
          }
        }
      }
    }
  },
  "components": {
    "schemas": {
      "inputSchema": {
        "type": "object",
        "required": [
          "usernames"
        ],
        "properties": {
          "usernames": {
            "title": "Instagram username(s)",
            "type": "array",
            "description": "Provide one or several Instagram user names you want to scrape the posts from. The actor will also handle user name IDs.",
            "items": {
              "type": "string"
            }
          },
          "includeAboutSection": {
            "title": "$ Extract about account information",
            "type": "boolean",
            "description": "This feature is for paying users only. If enabled, the scraper will extract information about the account, including date joined, country of origin, and the profile's channel information. Please beware that the country is there ONLY if the user filled in this information.",
            "default": false
          }
        }
      },
      "runsResponseSchema": {
        "type": "object",
        "properties": {
          "data": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string"
              },
              "actId": {
                "type": "string"
              },
              "userId": {
                "type": "string"
              },
              "startedAt": {
                "type": "string",
                "format": "date-time",
                "example": "2025-01-08T00:00:00.000Z"
              },
              "finishedAt": {
                "type": "string",
                "format": "date-time",
                "example": "2025-01-08T00:00:00.000Z"
              },
              "status": {
                "type": "string",
                "example": "READY"
              },
              "meta": {
                "type": "object",
                "properties": {
                  "origin": {
                    "type": "string",
                    "example": "API"
                  },
                  "userAgent": {
                    "type": "string"
                  }
                }
              },
              "stats": {
                "type": "object",
                "properties": {
                  "inputBodyLen": {
                    "type": "integer",
                    "example": 2000
                  },
                  "rebootCount": {
                    "type": "integer",
                    "example": 0
                  },
                  "restartCount": {
                    "type": "integer",
                    "example": 0
                  },
                  "resurrectCount": {
                    "type": "integer",
                    "example": 0
                  },
                  "computeUnits": {
                    "type": "integer",
                    "example": 0
                  }
                }
              },
              "options": {
                "type": "object",
                "properties": {
                  "build": {
                    "type": "string",
                    "example": "latest"
                  },
                  "timeoutSecs": {
                    "type": "integer",
                    "example": 300
                  },
                  "memoryMbytes": {
                    "type": "integer",
                    "example": 1024
                  },
                  "diskMbytes": {
                    "type": "integer",
                    "example": 2048
                  }
                }
              },
              "buildId": {
                "type": "string"
              },
              "defaultKeyValueStoreId": {
                "type": "string"
              },
              "defaultDatasetId": {
                "type": "string"
              },
              "defaultRequestQueueId": {
                "type": "string"
              },
              "buildNumber": {
                "type": "string",
                "example": "1.0.0"
              },
              "containerUrl": {
                "type": "string"
              },
              "usage": {
                "type": "object",
                "properties": {
                  "ACTOR_COMPUTE_UNITS": {
                    "type": "integer",
                    "example": 0
                  },
                  "DATASET_READS": {
                    "type": "integer",
                    "example": 0
                  },
                  "DATASET_WRITES": {
                    "type": "integer",
                    "example": 0
                  },
                  "KEY_VALUE_STORE_READS": {
                    "type": "integer",
                    "example": 0
                  },
                  "KEY_VALUE_STORE_WRITES": {
                    "type": "integer",
                    "example": 1
                  },
                  "KEY_VALUE_STORE_LISTS": {
                    "type": "integer",
                    "example": 0
                  },
                  "REQUEST_QUEUE_READS": {
                    "type": "integer",
                    "example": 0
                  },
                  "REQUEST_QUEUE_WRITES": {
                    "type": "integer",
                    "example": 0
                  },
                  "DATA_TRANSFER_INTERNAL_GBYTES": {
                    "type": "integer",
                    "example": 0
                  },
                  "DATA_TRANSFER_EXTERNAL_GBYTES": {
                    "type": "integer",
                    "example": 0
                  },
                  "PROXY_RESIDENTIAL_TRANSFER_GBYTES": {
                    "type": "integer",
                    "example": 0
                  },
                  "PROXY_SERPS": {
                    "type": "integer",
                    "example": 0
                  }
                }
              },
              "usageTotalUsd": {
                "type": "number",
                "example": 0.00005
              },
              "usageUsd": {
                "type": "object",
                "properties": {
                  "ACTOR_COMPUTE_UNITS": {
                    "type": "integer",
                    "example": 0
                  },
                  "DATASET_READS": {
                    "type": "integer",
                    "example": 0
                  },
                  "DATASET_WRITES": {
                    "type": "integer",
                    "example": 0
                  },
                  "KEY_VALUE_STORE_READS": {
                    "type": "integer",
                    "example": 0
                  },
                  "KEY_VALUE_STORE_WRITES": {
                    "type": "number",
                    "example": 0.00005
                  },
                  "KEY_VALUE_STORE_LISTS": {
                    "type": "integer",
                    "example": 0
                  },
                  "REQUEST_QUEUE_READS": {
                    "type": "integer",
                    "example": 0
                  },
                  "REQUEST_QUEUE_WRITES": {
                    "type": "integer",
                    "example": 0
                  },
                  "DATA_TRANSFER_INTERNAL_GBYTES": {
                    "type": "integer",
                    "example": 0
                  },
                  "DATA_TRANSFER_EXTERNAL_GBYTES": {
                    "type": "integer",
                    "example": 0
                  },
                  "PROXY_RESIDENTIAL_TRANSFER_GBYTES": {
                    "type": "integer",
                    "example": 0
                  },
                  "PROXY_SERPS": {
                    "type": "integer",
                    "example": 0
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}" "{
  "openapi": "3.0.1",
  "info": {
    "title": "Instagram Following Scraper (No Cookie)",
    "description": "Extract Instagram profile following in bulk without requiring login, session ID, or cookies. This actor provides complete API support, and seamless export options, making large-scale follower collection efficient and reliable.",
    "version": "0.0",
    "x-build-id": "pgyN19f8JHMMXVFBw"
  },
  "servers": [
    {
      "url": "https://api.apify.com/v2"
    }
  ],
  "paths": {
    "/acts/datadoping~instagram-following-scraper/run-sync-get-dataset-items": {
      "post": {
        "operationId": "run-sync-get-dataset-items-datadoping-instagram-following-scraper",
        "x-openai-isConsequential": false,
        "summary": "Executes an Actor, waits for its completion, and returns Actor's dataset items in response.",
        "tags": [
          "Run Actor"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/inputSchema"
              }
            }
          }
        },
        "parameters": [
          {
            "name": "token",
            "in": "query",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "Enter your Apify token here"
          }
        ],
        "responses": {
          "200": {
            "description": "OK"
          }
        }
      }
    },
    "/acts/datadoping~instagram-following-scraper/runs": {
      "post": {
        "operationId": "runs-sync-datadoping-instagram-following-scraper",
        "x-openai-isConsequential": false,
        "summary": "Executes an Actor and returns information about the initiated run in response.",
        "tags": [
          "Run Actor"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/inputSchema"
              }
            }
          }
        },
        "parameters": [
          {
            "name": "token",
            "in": "query",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "Enter your Apify token here"
          }
        ],
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/runsResponseSchema"
                }
              }
            }
          }
        }
      }
    },
    "/acts/datadoping~instagram-following-scraper/run-sync": {
      "post": {
        "operationId": "run-sync-datadoping-instagram-following-scraper",
        "x-openai-isConsequential": false,
        "summary": "Executes an Actor, waits for completion, and returns the OUTPUT from Key-value store in response.",
        "tags": [
          "Run Actor"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/inputSchema"
              }
            }
          }
        },
        "parameters": [
          {
            "name": "token",
            "in": "query",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "Enter your Apify token here"
          }
        ],
        "responses": {
          "200": {
            "description": "OK"
          }
        }
      }
    }
  },
  "components": {
    "schemas": {
      "inputSchema": {
        "type": "object",
        "required": [
          "usernames",
          "max_count"
        ],
        "properties": {
          "usernames": {
            "title": "Instagram Usernames or User ID or URL",
            "type": "array",
            "description": "List of Instagram usernames/userId/URL to scrape. Enter one username/userId/URL per line.",
            "items": {
              "type": "string"
            }
          },
          "max_count": {
            "title": "Max Following",
            "minimum": 50,
            "type": "integer",
            "description": "Maximum following to scrape per username. Default=50"
          }
        }
      },
      "runsResponseSchema": {
        "type": "object",
        "properties": {
          "data": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string"
              },
              "actId": {
                "type": "string"
              },
              "userId": {
                "type": "string"
              },
              "startedAt": {
                "type": "string",
                "format": "date-time",
                "example": "2025-01-08T00:00:00.000Z"
              },
              "finishedAt": {
                "type": "string",
                "format": "date-time",
                "example": "2025-01-08T00:00:00.000Z"
              },
              "status": {
                "type": "string",
                "example": "READY"
              },
              "meta": {
                "type": "object",
                "properties": {
                  "origin": {
                    "type": "string",
                    "example": "API"
                  },
                  "userAgent": {
                    "type": "string"
                  }
                }
              },
              "stats": {
                "type": "object",
                "properties": {
                  "inputBodyLen": {
                    "type": "integer",
                    "example": 2000
                  },
                  "rebootCount": {
                    "type": "integer",
                    "example": 0
                  },
                  "restartCount": {
                    "type": "integer",
                    "example": 0
                  },
                  "resurrectCount": {
                    "type": "integer",
                    "example": 0
                  },
                  "computeUnits": {
                    "type": "integer",
                    "example": 0
                  }
                }
              },
              "options": {
                "type": "object",
                "properties": {
                  "build": {
                    "type": "string",
                    "example": "latest"
                  },
                  "timeoutSecs": {
                    "type": "integer",
                    "example": 300
                  },
                  "memoryMbytes": {
                    "type": "integer",
                    "example": 1024
                  },
                  "diskMbytes": {
                    "type": "integer",
                    "example": 2048
                  }
                }
              },
              "buildId": {
                "type": "string"
              },
              "defaultKeyValueStoreId": {
                "type": "string"
              },
              "defaultDatasetId": {
                "type": "string"
              },
              "defaultRequestQueueId": {
                "type": "string"
              },
              "buildNumber": {
                "type": "string",
                "example": "1.0.0"
              },
              "containerUrl": {
                "type": "string"
              },
              "usage": {
                "type": "object",
                "properties": {
                  "ACTOR_COMPUTE_UNITS": {
                    "type": "integer",
                    "example": 0
                  },
                  "DATASET_READS": {
                    "type": "integer",
                    "example": 0
                  },
                  "DATASET_WRITES": {
                    "type": "integer",
                    "example": 0
                  },
                  "KEY_VALUE_STORE_READS": {
                    "type": "integer",
                    "example": 0
                  },
                  "KEY_VALUE_STORE_WRITES": {
                    "type": "integer",
                    "example": 1
                  },
                  "KEY_VALUE_STORE_LISTS": {
                    "type": "integer",
                    "example": 0
                  },
                  "REQUEST_QUEUE_READS": {
                    "type": "integer",
                    "example": 0
                  },
                  "REQUEST_QUEUE_WRITES": {
                    "type": "integer",
                    "example": 0
                  },
                  "DATA_TRANSFER_INTERNAL_GBYTES": {
                    "type": "integer",
                    "example": 0
                  },
                  "DATA_TRANSFER_EXTERNAL_GBYTES": {
                    "type": "integer",
                    "example": 0
                  },
                  "PROXY_RESIDENTIAL_TRANSFER_GBYTES": {
                    "type": "integer",
                    "example": 0
                  },
                  "PROXY_SERPS": {
                    "type": "integer",
                    "example": 0
                  }
                }
              },
              "usageTotalUsd": {
                "type": "number",
                "example": 0.00005
              },
              "usageUsd": {
                "type": "object",
                "properties": {
                  "ACTOR_COMPUTE_UNITS": {
                    "type": "integer",
                    "example": 0
                  },
                  "DATASET_READS": {
                    "type": "integer",
                    "example": 0
                  },
                  "DATASET_WRITES": {
                    "type": "integer",
                    "example": 0
                  },
                  "KEY_VALUE_STORE_READS": {
                    "type": "integer",
                    "example": 0
                  },
                  "KEY_VALUE_STORE_WRITES": {
                    "type": "number",
                    "example": 0.00005
                  },
                  "KEY_VALUE_STORE_LISTS": {
                    "type": "integer",
                    "example": 0
                  },
                  "REQUEST_QUEUE_READS": {
                    "type": "integer",
                    "example": 0
                  },
                  "REQUEST_QUEUE_WRITES": {
                    "type": "integer",
                    "example": 0
                  },
                  "DATA_TRANSFER_INTERNAL_GBYTES": {
                    "type": "integer",
                    "example": 0
                  },
                  "DATA_TRANSFER_EXTERNAL_GBYTES": {
                    "type": "integer",
                    "example": 0
                  },
                  "PROXY_RESIDENTIAL_TRANSFER_GBYTES": {
                    "type": "integer",
                    "example": 0
                  },
                  "PROXY_SERPS": {
                    "type": "integer",
                    "example": 0
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}" We can also take profiles that we know are 100% approved and use these scrapers in order to scrape the profile, scrape the following, and then scrape the profiles of the people that the person is following. Obviously, categorizing and analyzing it with our Crawl E scraper plus OpenAI analysis in order to determine whether they are fit We need to have a very deep, detailed analysis on this, and this is why we're doing a /phase-plan. + using $skill-oracle to make this plan detailed with the right skills being called to analyze this. make the plan extremly detailed and have it include this original request.

## Purpose
Materialize a new canonical discovery-planning phase that unifies Collabstr and Apify search, absorbs approved-seed social-graph traversal into the platform, normalizes category logic across sources, and replaces the current execution drift between UI intent and backend behavior.

## Context
- Repo truth confirmed before writing this phase:
  - `phase-13` is complete and already introduced grouped `apify` and `collabstr` category selection in onboarding and automations.
  - `phase-14` already exists locally as an overlapping untracked draft focused on creator validation and background job UX.
  - current runtime is still split:
    - campaign discovery uses the local Collabstr dataset and runs synchronously through `apps/web/lib/workers/creator-search.ts`
    - `/creators` search is Apify-only and async through `POST /api/creators/search`
    - automations store both category groups but `apps/web/lib/inngest/functions/run-automation.ts` still fires only the Apify path
    - mixed-source import currently hardcodes `discoverySource: "apify"` on search-result import
- New source-of-truth product context from the user:
  - the legacy `[AC] (1) Instagram Following [PROD]` workflow is a 68-node graph-traversal pipeline that:
    - scrapes followings from seed accounts
    - enriches each profile
    - applies a four-filter funnel
    - classifies bio category with OpenAI
    - deduplicates and saves the result set
  - the platform must improve on that pipeline, not merely coexist with it
- Decisions already locked in conversation:
  - source UX is `Selectable, Default Both`
  - the next phase includes approved-seed following expansion
  - canonical discovery vocabulary is `keywords + categories`
  - the supplied Apify APIs should be used as typed actor clients
  - Collabstr source-native labels must be preserved even if canonical categories are normalized separately
- Existing implementation capability relevant to this phase:
  - the repo already has `crawlee`, Playwright, Instagram HTML parsing helpers, a follower-refresh script, background jobs via Inngest, and AI fit-scoring infrastructure
  - there is no dedicated “CrawlE” package in the repo; the correct implementation interpretation is Crawlee/Playwright plus the current OpenAI scoring/classification surfaces

## Skills Available for Implementation
- `find-local-skills`: documented as required by the planning skill, but its documented local index path is missing in this environment. Fallback is manual selection from the installed in-session skill catalog.
- `find-skills`: present in the visible skill list, but its symlink target is missing on this machine. Treat as unavailable here and document the fallback.
- Selected implementable skills:
  - `backend-development`
  - `database-design`
  - `openapi-to-typescript`
  - `llm-application-dev`
  - `javascript-typescript`
  - `browser-automation`
  - `playwright-testing`
  - `qa-test-planner`
  - `requirements-clarity`
  - `skill-oracle`

## Concurrent Phases

| Phase | Status | Overlap | Coordination |
|-------|--------|---------|--------------|
| Phase 13 | Complete | Grouped category UX, automations, creator discovery surfaces | Treat Phase 13 as the runtime baseline. Build on its grouped category work rather than reintroducing split source logic. |
| Phase 14 | Untracked draft | Creator discovery, validation, background jobs | Preserve Phase 14 as historical draft context. Phase 15 is the canonical discovery roadmap going forward. |
| Phase 9 | Historical | Search worker, campaigns, review/import | Use only as background architecture context. Current repo behavior is the source of truth. |

## Objectives
* [ ] Unify Collabstr, Apify search, approved-seed following, and keyword-email enrichment under one shared discovery contract.
* [ ] Make manual search, campaign discovery, and scheduled automations all execute the same discovery pipeline.
* [ ] Preserve one global result limit after cross-source dedupe rather than running independent per-source limits.
* [ ] Normalize source-native category labels into one canonical category field while retaining raw source data for audit and future remapping.
* [ ] Replace the external social-graph traversal dependency with a platform-native approved-seed-following lane.
* [ ] Persist full provenance for every discovery touch so imported creators no longer lose source history.

## Constraints
- Source selection visible in product surfaces must match actual backend execution. No more grouped categories stored in config but ignored at run time.
- `collabstr` and `apify_search` are both selected by default, but operators must be able to disable either.
- `approved_seed_following` is optional and disabled by default.
- Approved-seed traversal is depth-1 only in this phase. No following-of-following recursion.
- `apify_keyword_email` is supplemental and cannot create importable creators without profile enrichment, category assignment, and fit scoring.
- Canonical discovery vocabulary in this phase is `keywords + categories`; broader taxonomy redesign is out of scope.
- Slack/Discord parity is not required in this phase. Platform-native job status, creator records, campaign review, and interventions are sufficient outputs.
- `CreatorSearchJob` must gain a first-class `campaignId` field (nullable) so campaign-triggered discovery jobs are queryable without parsing `query` JSON.
- Existing automation `config` Json blobs with `categories: { apify, collabstr }` must be migrated to the unified query shape or have a backward-compat adapter in the orchestrator.

## Success Criteria
- `/creators`, campaign search, and automations all accept the same discovery query shape and all run through the same orchestrator.
- Mixed-source candidate lists dedupe by normalized Instagram handle and obey one final limit after merge.
- Imported creators retain:
  - one backward-compatible primary `discoverySource`
  - full per-source provenance
  - canonical category
  - raw source category
- Approved-seed following works as a first-class optional lane using creators already approved in the platform.
- Category logic for Collabstr and Apify is normalized and no longer treated as separate operator taxonomies with divergent execution behavior.

## Repo Reality Check
See **Repo Reality Check (RED TEAM)** section below for the comprehensive verified check.
Summary of critical mismatches:
- `scripts/collabstr-influencers.jsonl` is GITIGNORED — not available in deployments
- `CreatorSearchResult` has NO `source` field — provenance model must add it
- Email actor mismatch: plan says `scraper-mind~instagram-email-scraper`, repo uses `express_jet/instagram-email-finder`
- Campaign search runs SYNCHRONOUSLY despite returning 202
- Both `apify-creator-search.ts` and `creator-search.ts` listen on same Inngest event

## Assumptions
- The canonical category taxonomy for this phase remains the March 1 five-category classifier plus `Other`.
- `bioCategory` remains the canonical category field name for backward compatibility.
- The repo’s existing Crawlee/Playwright stack is the right implementation surface for any internal scraping/enrichment work referenced by the user as “Crawl E”.
- **LOCKED**: Collabstr data is DB-backed — imported into the `Creator` table with `discoverySource: “collabstr”`, queried at search time. No JSONL file at runtime.
- **LOCKED**: `apify~instagram-search-scraper` replaces `apify/instagram-hashtag-scraper`. The `runInstagramHashtagScraper` function in `apps/web/lib/apify/client.ts` is deprecated.
- **LOCKED**: Both email actors coexist — `express_jet/instagram-email-finder` (per-handle enrichment) and `scraper-mind~instagram-email-scraper` (keyword-email discovery).
- **LOCKED**: Seed pool = creators with at least one `CampaignCreator` record where `reviewStatus = “approved”`, scoped to campaign context.
- Phase 15 should coexist with the untracked Phase 14 draft rather than overwrite it.

## Repo Reality Check (RED TEAM)

- What exists today:
  - `apps/web/lib/apify/client.ts` — wraps `apify/instagram-profile-scraper` and `apify/instagram-hashtag-scraper` (ApifyClient SDK)
  - `apps/web/lib/enrichment/providers/apify-email.ts` — wraps `express_jet/instagram-email-finder` (raw fetch, NOT the `scraper-mind~instagram-email-scraper` actor referenced in the user request)
  - `apps/web/lib/workers/creator-search.ts` — Collabstr lane, loads `scripts/collabstr-influencers.jsonl` from disk, scores with Fly worker or local OpenAI
  - `apps/web/lib/inngest/functions/apify-creator-search.ts` — async Apify lane, listens on `creator-search/requested`, guards on `discoverySource === "apify"`
  - `apps/web/lib/inngest/functions/creator-search.ts` — marketplace/Collabstr lane, ALSO listens on `creator-search/requested`, guards by skipping when `discoverySource === "apify"`
  - `apps/web/app/api/creators/search/route.ts` — Apify-only async search, creates job + fires Inngest event
  - `apps/web/app/api/campaigns/[campaignId]/search/route.ts` — calls `searchCreatorsForCampaign()` SYNCHRONOUSLY in request handler (returns 202 but work is done before response)
  - `apps/web/lib/inngest/functions/run-automation.ts` — cron every 5 min, derives single hashtag from categories, dispatches only Apify path
  - `apps/web/lib/categories/catalog.ts` — grouped `APIFY_CATEGORIES` (5 items) and `COLLABSTR_CATEGORIES` (12 items)
  - `scripts/collabstr-influencers.jsonl` — GITIGNORED, not in repo. Comment in `catalog.ts` says "The committed repo does not currently include scripts/collabstr-influencers.jsonl"
  - `apps/web/prisma/schema.prisma` — `Creator` (has `discoverySource`, `bioCategory`, `followerCount`, `avgViews`), `CreatorSearchJob` (has `brandId` but NOT `campaignId` as first-class field), `CreatorSearchResult` (has `bioCategory`, `fitScore` but NO `source`/`discoverySource` field), `Automation` (config is `Json`)
- What the plan assumes:
  - `scripts/collabstr-influencers.jsonl` exists — **WRONG**, it is gitignored and absent from committed repo
  - `CreatorSearchResult` can carry source info — **MISSING**, no `source` field exists on the model today
  - `CreatorSearchJob` tracks campaign context — only via `query` Json blob, not as a first-class field
  - There is one email scraper actor — there are TWO different actors: `express_jet/instagram-email-finder` (existing) and `scraper-mind~instagram-email-scraper` (new from user request)
  - `apify/instagram-hashtag-scraper` is the current search actor — but the user request provides `apify~instagram-search-scraper` which is a DIFFERENT actor with different input schema (`search` string + `searchType` enum vs `hashtags[]`)
- Verified touch points:
  - `apps/web/lib/apify/client.ts` — EXISTS, exports `runInstagramProfileScraper`, `runInstagramHashtagScraper`, `getDatasetItems`, `mapProfileToCreator`, `mapHashtagPostToCreator`
  - `apps/web/lib/workers/creator-search.ts` — EXISTS, exports `searchCreatorsForCampaign`
  - `apps/web/lib/brands/icp.ts` — EXISTS, exports `deriveBrandICP`, `icpToSearchHints`
  - `apps/web/lib/categories/catalog.ts` — EXISTS, exports `APIFY_CATEGORIES`, `COLLABSTR_CATEGORIES`, `getGroupedCategories`
  - `apps/web/lib/enrichment/providers/apify-email.ts` — EXISTS, exports `findEmailsByInstagramHandles`
  - `apps/web/app/(platform)/creators/page.tsx` — EXISTS
  - `apps/web/app/(platform)/creators/import/page.tsx` — EXISTS
  - `scripts/scrape-collabstr.ts` — EXISTS
  - `scripts/import-collabstr.ts` — EXISTS

## Skill Feasibility (RED TEAM)

- Critical skill check:
  - `find-local-skills` → MISSING (index path `/home/podhi/.openclaw/...` does not exist in this environment)
  - `find-skills` → MISSING (symlink target absent)
  - `backend-development` → available in session skill catalog
  - `database-design` → available in session skill catalog
  - `openapi-to-typescript` → available in session skill catalog
  - `llm-application-dev` → available in session skill catalog
  - `javascript-typescript` → available in session skill catalog
  - `browser-automation` → available in session skill catalog
  - `playwright-testing` → available in session skill catalog
  - `qa-test-planner` → available in session skill catalog
  - `requirements-clarity` → available in session skill catalog
- Missing but required:
  - `find-local-skills` → fallback: manual skill selection from session catalog (already documented)
  - `find-skills` → fallback: manual skill selection from session catalog (already documented)

## RED TEAM Findings (Gaps / Weak Spots)

### Highest-risk failure modes
- **Collabstr dataset not in repo** — `scripts/collabstr-influencers.jsonl` is gitignored. Any deployment or fresh checkout will fail the Collabstr lane. → **Mitigation**: 15a must define a runtime data provisioning strategy (DB-backed query, S3 download, or committed seed file). The current disk-read approach is not deployable.
- **Dual Inngest listener collision** — Both `apify-creator-search.ts` and `creator-search.ts` listen on the same `"creator-search/requested"` event with runtime guards. The unified orchestrator must replace this pattern entirely, not add a third listener. → **Mitigation**: 15b must explicitly deprecate the dual-listener pattern and 15c must remove or consolidate both handlers.
- **Campaign search is synchronous** — `POST /api/campaigns/[campaignId]/search` calls `searchCreatorsForCampaign()` synchronously. The plan says "convert to async" but 15c step 2 lacks specifics. → **Mitigation**: 15c must specify: create job record, fire Inngest event, return `{ jobId }`, add polling endpoint.

### Missing or ambiguous requirements
- **Email actor disambiguation** — The plan references `scraper-mind~instagram-email-scraper` (keyword-email lane) but the codebase already uses `express_jet/instagram-email-finder` (handle-email lookup). These serve different purposes (keyword→email discovery vs handle→email enrichment). The plan should specify which is used where and whether both coexist.
- **Search actor transition** — The plan introduces `apify~instagram-search-scraper` but the codebase currently uses `apify/instagram-hashtag-scraper`. These have different input schemas. The plan should specify: is the hashtag scraper deprecated, or do both coexist? What's the migration for existing automations that store `hashtag` in their config?
- **Automation config migration** — Current automation configs store `categories: { apify: string[], collabstr: string[] }`. The unified query uses `canonicalCategories`. The plan must specify how existing configs are migrated.

### Repo mismatches (fix the plan)
- `scripts/collabstr-influencers.jsonl` — referenced as "Existing Collabstr dataset path" in 15b but does NOT exist in committed repo (gitignored)
- `CreatorSearchResult` — plan assumes source tracking but model has no `source` or `discoverySource` field
- `CreatorSearchJob` — plan assumes campaign tracking but model has no `campaignId` field (only in `query` Json)
- Email actor: plan says `scraper-mind~instagram-email-scraper` but existing code uses `express_jet/instagram-email-finder`

### Performance / timeouts
- **Apify actor timeout** — The `run-sync-get-dataset-items` endpoint blocks until actor completion. For large keyword-email or following scrapes, this can easily exceed HTTP timeouts. → **Mitigation**: Use async `runs` endpoint + polling (the existing `apify-email.ts` already does this correctly).
- **Multi-lane parallel execution** — Running 4 lanes in parallel (Collabstr + Apify search + seed following + keyword email) can exhaust Apify concurrency limits and spike costs. → **Mitigation**: Define per-lane timeouts and an Apify compute budget ceiling per discovery run.
- **Collabstr dataset scan** — Loading the full JSONL into memory for every search (current `creator-search.ts` approach) doesn't scale. → **Mitigation**: 15b should specify whether the Collabstr source becomes DB-backed or remains file-based.

### Security / permissions
- **APIFY_API_TOKEN exposure** — New actor clients must use the same env var gating as existing code. Verify `APIFY_API_TOKEN` is in `.env.example`.
- **Source selection input validation** — The unified query accepts user-specified `sources[]`. Validate against the allowed source enum to prevent injection of arbitrary source names.

### Testing / validation
- **No integration test coverage specified** — The plan lists success criteria but no specific test commands, fixtures, or mock strategies for the Apify actor calls.
- **Missing Collabstr data test strategy** — If the JSONL is gitignored, tests need a fixture/mock. The plan should specify this.

## Open Questions (Need Human Input)

- [x] **Collabstr data source strategy** — **LOCKED: DB-backed**
  - Why it matters: The `scripts/collabstr-influencers.jsonl` file is gitignored and absent from the repo. The current disk-read approach works only on machines where the scraper has run. This affects whether the Collabstr lane works in CI, staging, and production deployments.
  - **LOCKED**: Import JSONL into the `Creator` table with `discoverySource: "collabstr"`. The scraper writes to DB, not disk. The Collabstr lane queries the DB at search time instead of reading a local file.

- [x] **Email actor coexistence** — **LOCKED: Both coexist**
  - Why it matters: The plan references `scraper-mind~instagram-email-scraper` for the keyword-email lane, but the repo already has `express_jet/instagram-email-finder` for handle→email lookups. If both are needed, two actor clients must be maintained. If only one, the plan should specify which.
  - **LOCKED**: Both actors coexist — `express_jet/instagram-email-finder` for per-handle enrichment (existing), `scraper-mind~instagram-email-scraper` for keyword-email discovery (new lane).

- [x] **Search actor transition** — **LOCKED: Replace**
  - Why it matters: `apify~instagram-search-scraper` (user-provided) has a different input schema than `apify/instagram-hashtag-scraper` (currently used). Switching affects existing automation configs that store `hashtag` in their query JSON.
  - **LOCKED**: `apify~instagram-search-scraper` replaces `apify/instagram-hashtag-scraper` (it supports both `searchType: "user"` and `"hashtag"`, strictly more capable). Existing automation configs are migrated in 15c with `config.hashtag` → `config.search` + `config.searchType` mapping.

## Subphase Index
* a — Lock the unified discovery contract, provenance schema, and typed actor clients
* b — Build the multi-lane orchestrator and normalized candidate pipeline
* c — Migrate manual search, campaign search, and automations onto the unified engine
* d — Implement approved-seed following and supplemental keyword-email enrichment
* e — Backfill, QA, rollout, and phase-overlap cutover rules

## Phase Summary (running)
- 2026-03-09 23:17 EDT — Completed Phase 15a groundwork: added `UnifiedDiscoveryQuery`, typed Apify actor clients for the user-supplied APIs, provenance storage, `CreatorSearchJob.campaignId`, source-aware `CreatorSearchResult` fields, DB-backed Collabstr reads with JSONL fallback, and focused contract/mapping tests. Local `next build` now passes when the repo-root `.env.local` is sourced into the shell before building from `apps/web`; `apps/web/.env.local` alone only exposes `NEXT_PUBLIC_BOOKING_URL`. (files: `apps/web/lib/creator-search/contracts.ts`, `apps/web/lib/creator-search/provenance.ts`, `apps/web/lib/apify/client.ts`, `apps/web/prisma/schema.prisma`, `apps/web/app/api/creators/search/route.ts`, `apps/web/app/api/campaigns/[campaignId]/search/route.ts`, `apps/web/app/api/automations/route.ts`, `apps/web/lib/inngest/functions/apify-creator-search.ts`, `apps/web/lib/inngest/functions/creator-search.ts`, `apps/web/lib/inngest/functions/run-automation.ts`, `apps/web/lib/workers/creator-search.ts`, `scripts/import-collabstr.ts`, `apps/web/__tests__/creator-search/*.test.ts`)
- 2026-03-09 23:22 EDT — Started Phase 15b by adding a reusable discovery orchestrator, canonical category classifier, and candidate merge helpers. The module can now collect and merge `collabstr`, `apify_search`, `approved_seed_following`, and `apify_keyword_email` candidates, but the live routes still need 15c wiring and shared fit scoring extraction before unified runtime behavior is complete. (files: `apps/web/lib/creator-search/classification.ts`, `apps/web/lib/creator-search/candidate-merge.ts`, `apps/web/lib/creator-search/orchestrator.ts`, `apps/web/lib/creator-search/orchestrator-types.ts`, `apps/web/__tests__/creator-search/classification.test.ts`)
- 2026-03-09 23:37 EDT — Started Phase 15c backend migration: unified the Inngest search handler around stored `CreatorSearchJob.query`, removed the competing Apify listener registration, added campaign job polling, switched dispatch payloads to the unified query, and patched creator import-from-search to preserve lane source instead of forcing `apify`. UI migration remains partially blocked on overlapping uncommitted changes in the creators/campaign pages. (files: `apps/web/app/api/inngest/route.ts`, `apps/web/lib/inngest/functions/creator-search.ts`, `apps/web/app/api/creators/search/route.ts`, `apps/web/app/api/campaigns/[campaignId]/search/route.ts`, `apps/web/app/api/campaigns/[campaignId]/search/[jobId]/route.ts`, `apps/web/lib/inngest/functions/run-automation.ts`, `apps/web/app/(platform)/creators/page.tsx`, `docs/planning/phase-15/c/plan.md`)
