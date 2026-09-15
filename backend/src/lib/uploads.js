import multer from 'multer'

const MAX_FILE_SIZE_MB = 5
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const DOCUMENT_MIME_TYPES = [...IMAGE_MIME_TYPES, 'application/pdf']

const PROPERTY_IMAGES_MAX_COUNT = 10

function fileFilterFor(allowedMimeTypes, label) {
  return (req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true)
      return
    }
    cb(
      Object.assign(new Error(`Only ${label} files are allowed`), {
        code: 'INVALID_FILE_TYPE',
      }),
    )
  }
}

export const propertyImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: PROPERTY_IMAGES_MAX_COUNT },
  fileFilter: fileFilterFor(IMAGE_MIME_TYPES, 'JPEG, PNG, or WEBP image'),
})

export const verificationDocumentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 },
  fileFilter: fileFilterFor(DOCUMENT_MIME_TYPES, 'JPEG, PNG, WEBP, or PDF'),
})

// multer surfaces both its own limit errors and fileFilter errors via
// the callback multer.<method>() takes as its third argument, not as
// a thrown/rejected error — calling multerMiddleware directly as
// Express middleware would let those reach the generic catch-all
// error handler as an unexplained 500. This wraps it so upload
// problems get a clean, specific 400 instead.
export function withUploadErrorHandling(multerMiddleware) {
  return (req, res, next) => {
    multerMiddleware(req, res, (err) => {
      if (!err) {
        next()
        return
      }

      if (err.code === 'LIMIT_FILE_SIZE') {
        res
          .status(400)
          .json({ error: `File too large — max ${MAX_FILE_SIZE_MB}MB per file` })
        return
      }
      if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
        res.status(400).json({
          error: `Too many files — max ${PROPERTY_IMAGES_MAX_COUNT} per upload`,
        })
        return
      }
      if (err.code === 'INVALID_FILE_TYPE') {
        res.status(400).json({ error: err.message })
        return
      }

      res.status(400).json({ error: 'Failed to process uploaded file(s)' })
    })
  }
}
