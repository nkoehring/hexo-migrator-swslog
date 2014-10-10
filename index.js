var fs = require('fs'),
    async = require('async'),
    request = require('request'),
    textile = require('textile-js').convert,
    toMarkdown = require('to-markdown').toMarkdown;

hexo.extend.migrator.register('swslog', function(args, callback){
  var source = args._.shift();

  if (!source){
    var help = [
      'Usage: hexo migrate swslog <source>',
      '',
      'where <source> is the URL or path to articles.json.',
      'For more help, you can check the docs: http://hexo.io/docs/migration.html'
    ];

    console.log(help.join('\n'));
    return callback();
  }

  var stream, json, parse, posts = [], isURL, articlesCount, articlesProcessed,
      log = hexo.log,
      articlesURI = source.replace(/articles\.json$/, "articles/"),
      contentErrorTemplate = "## content loading error\n" +
                             "The migrator was not able to load the content for this post.\n" +
                             "Please load it manually at " + articlesURI;

  streamSucceeded = function(error, response) {
    if(error) { callback(error); return false; }
    if(response.statusCode >= 300) {
      var err = response.statusCode + ": " + response.statusMessage;
      callback(err);
      return false;
    }

    return true;
  };

  parseMetaData = function(error, response, body) {
    if(!streamSucceeded(error, response)) return;

    json = JSON.parse(body);
    articlesCount = Object.keys(json.articles).length;
    articlesProcessed = 0;
    log.i("%d articles found", articlesCount);

    Object.keys(json.articles).forEach(function(stamp) {
      var meta = json.articles[stamp],
          post = {
            title: meta.title,
            date: parseInt(stamp) * 1000,
            tags: meta.tags,
            content: contentErrorTemplate + stamp
          },
          parseFunc = function(err, response, body) {
            if(!streamSucceeded(error, response)) return;

            post.content = parseArticle(body);
            articlesProcessed++;
            if(articlesProcessed === articlesCount) createPosts();
          },
          articleStream = isURL ?
                          request(articlesURI + stamp, parseFunc) :
                          fs.createReadStream(articleURI + stamp, parseFunc);

      posts.push(post);
    });
  };

  parseArticle = function(body) {
    return toMarkdown(textile(body));
  };

  createPosts = function() {
    async.each(posts, function(item, next){
      hexo.post.create(item, next);
    }, function(err){
      if(err) return callback(err);

      log.i('%d posts migrated.', posts.length);
      callback();
    });

  };

  // URL regular expression from: http://blog.mattheworiordan.com/post/13174566389/url-regular-expression-for-links-with-or-without-the
  if (source.match(/((([A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=\+\$,\w]+@)?[A-Za-z0-9.-]+|(?:www.|[-;:&=\+\$,\w]+@)[A-Za-z0-9.-]+)((?:\/[\+~%\/.\w-_]*)?\??(?:[-\+=&;%@.\w_]*)#?(?:[.\!\/\\w]*))?)/)){
    isURL = true;
    stream = request(source, parseMetaData);
  } else {
    stream = fs.createReadStream(source, parseMetaData);
  }

  log.i('Loading %s...', source);
});
