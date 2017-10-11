const Readable = require('stream').Readable
const SearchIndexAdder = require('../')
const SearchIndexSearcher = require('search-index-searcher')
const docProc = require('docproc')
const pumpify = require('pumpify')
const test = require('tape')

const data = [
  {
    id: 'one',
    title: 'First',
    price: 8,
    text: {
      The: 'first doc'
    }
  },
  {
    id: 'two',
    title: 'Second',
    price: 6,
    text: 'the SeCond doc'
  },
  {
    id: 'three',
    title: 'third',
    price: 7,
    text: 'the third DoC'
  },
  {
    id: 'four',
    title: 'four',
    price: 9,
    text: 'the fourth dOc'
  }
]

test('make the search index, removing the pipeline stage that bumps text to lower case', function (t) {
  t.plan(6)
  const s = new Readable({ objectMode: true })
  data.forEach(function (stone) {
    s.push(stone)
  })
  s.push(null)

  SearchIndexAdder({
    indexPath: 'test/sandbox/customPipeline',
    stopwords: ['the'],
    fieldOptions: {
      title: {
        weight: 2
      },
      price: {
        sortable: true
      }
    }
  }, function (err, si) {
    t.error(err)
    s.pipe(pumpify.obj(
      // the LowerCase stage is removed
      new docProc.IngestDoc(si.options),
      new docProc.CreateStoredDocument(si.options),
      new docProc.NormaliseFields(si.options),
      new docProc.Tokeniser(si.options),
      new docProc.RemoveStopWords(si.options),
      new docProc.CalculateTermFrequency(si.options),
      new docProc.CreateCompositeVector(si.options),
      new docProc.FieldedSearch(si.options)
    )).on('data', function (data) {
      t.looseEqual(
          Object.keys(data),
          [ 'normalised', 'options', 'raw', 'stored', 'tokenised', 'vector', 'id' ])
    })
      .pipe(si.add())
      .on('data', function () {})
      .on('finish', function () {
        si.close(function (err) {
          t.error(err)
        })
      })
  })
})

test('confirm can search with document deleted', function (t) {
  t.plan(3)
  SearchIndexSearcher({
    indexPath: 'test/sandbox/customPipeline'
  }, function (err, si) {
    t.error(err)
    si.search({
      query: {
        AND: {'*': ['DoC']}
      }
    }).on('data', function (data) {
      t.equals(data.document.id, 'three')
    }).on('end', function () {
      si.close(function (err) {
        t.error(err)
      })
    })
  })
})

// do stuff with customising pipelines here

