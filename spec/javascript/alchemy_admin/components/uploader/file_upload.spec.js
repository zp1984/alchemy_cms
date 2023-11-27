import { FileUpload } from "alchemy_admin/components/uploader/file_upload"
import mock from "xhr-mock"

describe("alchemy-file-upload", () => {
  /**
   * @type {FileUpload}
   */
  let component = undefined

  let progressBar = undefined
  let fileName = undefined
  let loadedSize = undefined
  let cancelButton = undefined
  let image = undefined
  let errorMessage = undefined

  const testFile = new File(["a".repeat(1100)], "foo.txt")

  const mockXMLHttpRequest = (status = 200, response = {}) => {
    mock.setup()
    mock.post("/admin/pictures", {
      status,
      body: JSON.stringify(response)
    })

    let request = new XMLHttpRequest()
    request.abort = jest.fn() // necessary to test abort mechanic

    return request
  }

  /**
   * initialize file progress component with the correct constructor
   * @param {File} file the default file has a size of 100 B
   * @param {XMLHttpRequest} request default request
   */
  const renderComponent = (file = testFile, request = mockXMLHttpRequest()) => {
    component = new FileUpload(file, request)
    document.body.innerHTML = "" // reset previous content to prevent raise conditions
    document.body.append(component)

    progressBar = document.querySelector("progress")
    fileName = document.querySelector(".file-name")
    loadedSize = document.querySelector(".loaded-size")
    cancelButton = document.querySelector("button")
    image = document.querySelector("img")
    errorMessage = document.querySelector(".error-message")
  }

  beforeAll(() => {
    // ignore missing translation warnings
    global.console = {
      ...console,
      warn: jest.fn()
    }
  })

  beforeEach(() => {
    Alchemy = {
      growl: jest.fn(),
      uploader_defaults: {
        file_size_limit: 100,
        upload_limit: 50,
        allowed_filetype_pictures: "webp, png, svg",
        allowed_filetype_attachments: "*"
      }
    }
    renderComponent()
  })

  afterEach(() => mock.teardown())

  describe("Initial State", () => {
    it("should render a progress bar", () => {
      expect(progressBar).toBeTruthy()
    })

    it("should show the name", () => {
      expect(fileName.textContent).toEqual("foo.txt")
    })

    it("should show the file size", () => {
      expect(loadedSize.textContent).toEqual("0.00 B / 1.07 kB")
    })

    it("should show a cancel button", () => {
      expect(cancelButton).toBeTruthy()
    })

    it("should marked as in progress", () => {
      expect(component.className).toEqual("in-progress")
    })

    it("should not have an image", () => {
      expect(image).toBeFalsy()
    })

    it("should have an empty error message", () => {
      expect(errorMessage.textContent).toEqual("")
    })

    describe("with image file", () => {
      beforeEach(() => {
        // mock file reader to response with an (invalid) image
        jest.spyOn(global, "FileReader").mockImplementation(function () {
          this.readAsDataURL = jest.fn()
          this.addEventListener = (methodName, callback) => callback() // run the load callback
          this.result = "data:image/png;base64,undefined"
        })

        renderComponent(
          new File(["a".repeat(100)], "foo.png", { type: "image/png" })
        )
      })

      it("should render an image", () => {
        expect(image).toBeTruthy()
      })
    })
  })

  describe("cancel upload", () => {
    it("should abort request", () => {
      cancelButton.click()
      expect(component.request.abort).toBeCalledTimes(1)
    })

    it("set the status to canceled", () => {
      cancelButton.click()
      expect(component.className).toEqual("canceled")
    })

    it("can be canceled from outside", () => {
      component.cancel()
      expect(component.className).toEqual("canceled")
    })
  })

  describe("request", () => {
    describe("progress", () => {
      function prepareProgressEvent(loaded = 0, total = 100) {
        component.request.upload.onprogress(
          new ProgressEvent("load", { loaded, total })
        )
      }

      it("should set the value", () => {
        prepareProgressEvent(7)
        expect(component.value).toEqual(7)
      })

      it("should update the text value (and the total size)", () => {
        prepareProgressEvent(8, 120)
        expect(loadedSize.textContent).toEqual("8.00 B / 120.00 B")
      })
    })

    describe("onload - file was uploaded", () => {
      describe("successful server response", () => {
        beforeEach(() => {
          const xhrMock = mockXMLHttpRequest(200, {
            growl_message: "Foo Bar"
          })
          renderComponent(testFile, xhrMock)
          component.request.open("post", "/admin/pictures")
          component.request.send()
        })

        it("should call the growl method", () => {
          expect(Alchemy.growl).toHaveBeenCalledWith("Foo Bar")
          expect(Alchemy.growl).toHaveBeenCalledTimes(1)
        })

        it("should mark as successful", () => {
          expect(component.className).toEqual("successful")
        })

        it("should not have an error message", () => {
          expect(component.errorMessage).toEqual("")
        })
      })

      describe("failed server response", () => {
        beforeEach(() => {
          const xhrMock = mockXMLHttpRequest(400, {
            growl_message: "Error: Foo Bar"
          })
          renderComponent(testFile, xhrMock)
          component.request.open("post", "/admin/pictures")
          component.request.send()
        })

        it("should call the growl method", () => {
          expect(Alchemy.growl).toHaveBeenCalledWith("Error: Foo Bar", "error")
          expect(Alchemy.growl).toHaveBeenCalledTimes(1)
        })

        it("should mark as failed", () => {
          expect(component.className).toEqual("failed")
        })

        it("should have an error message", () => {
          expect(component.errorMessage).toEqual("Error: Foo Bar")
        })
      })
    })

    describe("onerror", () => {
      it("should call the growl method", () => {
        component.request.onerror()

        expect(Alchemy.growl).toHaveBeenCalledWith(
          "An error occurred during the transaction",
          "error"
        )
        expect(Alchemy.growl).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe("value", () => {
    it("changes the progress bar value", () => {
      component.value = 30
      expect(progressBar.value).toEqual(30)
    })

    it("value should readable", () => {
      component.value = 30
      expect(component.value).toEqual(30)
    })

    it("should mark the upload as finished", () => {
      component.value = 100
      expect(component.className).toEqual("upload-finished")
    })
  })

  describe("valid", () => {
    it("can change the valid status", () => {
      component.valid = false
      expect(component.valid).toBeFalsy()
    })

    it("mark the progress as invalid", () => {
      component.valid = false
      expect(component.className).toEqual("in-progress invalid")
    })
  })

  describe("errorMessage", () => {
    it("can change error message", () => {
      component.errorMessage = "foo"
      expect(component.errorMessage).toEqual("foo")
    })

    it("should show the error message", () => {
      component.errorMessage = "foo"
      expect(errorMessage.textContent).toEqual("foo")
    })
  })

  describe("active", () => {
    it("should be active by default", () => {
      expect(component.active).toBeTruthy()
    })

    it("should be inactive if the upload is invalid", () => {
      component.valid = false
      expect(component.active).toBeFalsy()
    })

    it("should be inactive if the upload was canceled", () => {
      component.cancel()
      expect(component.active).toBeFalsy()
    })
  })

  describe("finished", () => {
    it("should be false by default", () => {
      expect(component.finished).toBeFalsy()
    })

    it("should be marked as finished if the status is canceled", () => {
      component.status = "canceled"
      expect(component.finished).toBeTruthy()
    })

    it("should be marked as finished if the status is successful", () => {
      component.status = "successful"
      expect(component.finished).toBeTruthy()
    })

    it("should be marked as finished if the status is failed", () => {
      component.status = "failed"
      expect(component.finished).toBeTruthy()
    })

    it("should be marked as finsihed if the file is processed", () => {
      renderComponent()
      component.request.onload()

      expect(component.finished).toBeTruthy()
    })
  })

  describe("Initialization without arguments", () => {
    it("should reset file size based variables", () => {
      component = new FileUpload()
      expect(component.value).toEqual(0)
    })
  })

  describe("Validate", () => {
    beforeAll(() => {
      // suppress missing translation warnings
      global.console = {
        ...console,
        warn: jest.fn()
      }
    })

    beforeEach(() => {
      Alchemy.uploader_defaults.file_size_limit = 100
      Alchemy.uploader_defaults.allowed_filetype_attachments = "*"
      Alchemy.uploader_defaults.allowed_filetype_pictures = "webp, png, svg"
    })

    describe("file size", () => {
      describe("100MB file limit", () => {
        it("should be valid", () => {
          expect(component.valid).toBeTruthy()
        })
      })

      describe("1KB file limit", () => {
        beforeEach(() => {
          Alchemy.uploader_defaults.file_size_limit = 0.001
          renderComponent()
        })

        it("should call the growl method", () => {
          expect(Alchemy.growl).toHaveBeenCalledWith(
            "Uploaded bytes exceed file size",
            "error"
          )
          expect(Alchemy.growl).toHaveBeenCalledTimes(1)
        })

        it("should be invalid", () => {
          expect(component.valid).toBeFalsy()
        })

        it("should show the invalid message", () => {
          expect(errorMessage.textContent).toEqual(
            "Uploaded bytes exceed file size"
          )
        })
      })
    })

    describe("file format", () => {
      describe("Image Formats", () => {
        const validImageFile = new File(["a".repeat(100)], "foo.webp", {
          type: "image/webp"
        })
        const svgImageFile = new File(["a".repeat(100)], "foo.svg", {
          type: "image/svg+xml"
        })
        const invalidImageFile = new File(["a".repeat(100)], "foo.gif", {
          type: "image/gif"
        })

        describe("allowed_filetype_pictures based of file types", () => {
          describe("valid file", () => {
            it("should be valid", () => {
              renderComponent(validImageFile)
              expect(component.valid).toBeTruthy()
            })

            it("should not have an error message", () => {
              renderComponent(validImageFile)
              expect(errorMessage.textContent).toEqual("")
            })

            it("should also work with svg", () => {
              renderComponent(svgImageFile)
              expect(component.valid).toBeTruthy()
            })
          })

          describe("invalid file", () => {
            beforeEach(() => renderComponent(invalidImageFile))

            it("should be valid", () => {
              expect(component.valid).toBeFalsy()
            })

            it("should have an error message", () => {
              expect(errorMessage.textContent).toEqual("File type not allowed")
            })

            it("should mark the file as invalid", () => {
              expect(component.classList).toContain("invalid")
            })
          })
        })

        describe("allowed_filetype_pictures as wildcard", () => {
          beforeEach(() => {
            Alchemy.uploader_defaults.allowed_filetype_pictures = "*"
            renderComponent(invalidImageFile)
          })

          it("should be valid", () => {
            expect(component.valid).toBeTruthy()
          })
        })
      })

      describe("Other Formats", () => {
        const invalidFile = new File(["a".repeat(100)], "foo.pdf", {
          type: "application/pdf"
        })

        describe("allowed_filetype_attachments based of file types", () => {
          beforeEach(() => {
            Alchemy.uploader_defaults.allowed_filetype_attachments = "txt, foo"
            renderComponent(invalidFile)
          })

          it("should be invalid", () => {
            expect(component.valid).toBeFalsy()
          })

          it("should call the growl method", () => {
            expect(Alchemy.growl).toHaveBeenCalledWith(
              "File type not allowed",
              "error"
            )
            expect(Alchemy.growl).toHaveBeenCalledTimes(1)
          })

          it("should have an error message", () => {
            expect(component.errorMessage).toEqual("File type not allowed")
          })
        })

        describe("allowed_filetype_attachments as wildcard", () => {
          beforeEach(() => {
            Alchemy.uploader_defaults.allowed_filetype_attachments = "*"
            renderComponent(invalidFile)
          })

          it("should be valid", () => {
            expect(component.valid).toBeTruthy()
          })
        })
      })
    })
  })
})
