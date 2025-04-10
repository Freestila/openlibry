import { BookType } from "@/entities/BookType";
import { getAllBooks } from "@/entities/book";
import { chunkArray } from "@/utils/chunkArray";
import { PrismaClient } from "@prisma/client";
import ReactPDF, {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import bwipjs from "bwip-js";
import { NextApiRequest, NextApiResponse } from "next";
const { join } = require("path");

const SCHOOL_NAME = process.env.SCHOOL_NAME || "Eigentum Schule";

const BOOKLABEL_MARGIN_LEFT = process.env.BOOKLABEL_MARGIN_LEFT
  ? parseInt(process.env.BOOKLABEL_MARGIN_LEFT)
  : 1;
const BOOKLABEL_MARGIN_TOP = process.env.BOOKLABEL_MARGIN_TOP
  ? parseInt(process.env.BOOKLABEL_MARGIN_TOP)
  : 2;
const BOOKLABEL_SPACING = process.env.BOOKLABEL_SPACING
  ? parseFloat(process.env.BOOKLABEL_SPACING)
  : 5.5;
const BOOKLABEL_ROWSONPAGE = process.env.BOOKLABEL_ROWSONPAGE
  ? process.env.BOOKLABEL_ROWSONPAGE
  : 5;
const BOOKLABEL_COLUMNSONPAGE = process.env.BOOKLABEL_COLUMNSONPAGE
  ? process.env.BOOKLABEL_COLUMNSONPAGE
  : 2;
const BOOKLABEL_BARCODE_WIDTH = process.env.BOOKLABEL_BARCODE_WIDTH
  ? process.env.BOOKLABEL_BARCODE_WIDTH
  : "3cm";
const BOOKLABEL_BARCODE_HEIGHT = process.env.BOOKLABEL_BARCODE_HEIGHT
  ? process.env.BOOKLABEL_BARCODE_HEIGHT
  : "1.6cm";
const BOOKLABEL_BARCODE_VERSION = process.env.BOOKLABEL_BARCODE_VERSION
  ? process.env.BOOKLABEL_BARCODE_VERSION
  : "code128";

const BOOKLABEL_BARCODE_PLACEHOLDER = process.env.BOOKLABEL_BARCODE_PLACEHOLDER
  ? process.env.BOOKLABEL_BARCODE_PLACEHOLDER
  : "barcode";

const BOOKLABEL_AUTHOR_SPACING = process.env.BOOKLABEL_AUTHOR_SPACING
  ? process.env.BOOKLABEL_AUTHOR_SPACING
  : "4.2cm";

const prisma = new PrismaClient();
var fs = require("fs");
var schoollogo = fs.readFileSync(
  join(process.cwd(), "/public/" + process.env.BOOKLABEL_LOGO)
);

const styles = StyleSheet.create({
  section: {
    margin: 10,
    padding: 10,
    flexGrow: 1,
    fontSize: 8,

    flexDirection: "row",
    alignContent: "center",
    justifyContent: "flex-start",
  },
  pageContainer: {
    flexDirection: "column",
    alignContent: "flex-start",
    justifyContent: "flex-start",
  },
  labelRowContainer: {
    flexDirection: "row",
    alignContent: "flex-start",
    justifyContent: "flex-start",
  },
  labelContainer: {
    flexDirection: "row",
    alignContent: "flex-start",
    justifyContent: "flex-start",
  },
  barCodeContainer: {
    flexDirection: "column",
    alignContent: "flex-start",
    justifyContent: "flex-start",
  },
});

const generateBarcode = async (books: Array<BookType>) => {
  const result = "";
  let allcodes = await Promise.all(
    books.map(async (b: BookType, i: number) => {
      const barId = process.env.BARCODE_MINCODELENGTH != null ? b.id!.toString().padStart(parseInt(process.env.BARCODE_MINCODELENGTH)) : b.id!.toString();
      const png =
        BOOKLABEL_BARCODE_PLACEHOLDER == "barcode"
          ? await bwipjs.toBuffer({
            bcid: BOOKLABEL_BARCODE_VERSION,
            text: barId,
            scale: 3,
            height: 10,
            includetext: true,
            textxalign: "center",
          })
          : schoollogo;
      const pos = {
        left: BOOKLABEL_MARGIN_LEFT + (i % 10 <= 4 ? 1 : 10) + "cm",
        top: BOOKLABEL_MARGIN_TOP + BOOKLABEL_SPACING * (i % 5) + "cm",
      };

      console.log("Position", pos, i);

      //Find first topic of book
      const firstTopic = b.topics ? b.topics!.split(";")[0] : ""

      return (
        <div key={b.id!}>
          <View
            style={{
              position: "absolute",
              flexDirection: "column",

              left: pos.left,
              top: pos.top,
              width: "5cm",
              padding: 0,
              margin: 0,
            }}
          >
            <View
              style={{
                flexDirection: "column",
              }}
            >
              <Text
                style={{
                  transform: "rotate(-90deg)",
                  fontSize: 9,
                  left: "-" + BOOKLABEL_AUTHOR_SPACING,
                }}
              >
                {b.author.length > 15
                  ? b.author.substring(0, 15) + "..."
                  : b.author}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  width: "5cm",
                }}
              >
                {b.title}
              </Text>
              <Image
                key={b.id}
                src={"data:image/png;base64, " + (await png.toString("base64"))}
                style={{
                  width: BOOKLABEL_BARCODE_WIDTH,
                  height: BOOKLABEL_BARCODE_HEIGHT,
                }}
              />
              <Text style={{ fontSize: 10 }}>
                {

                  firstTopic.length > 30
                    ? firstTopic.substring(0, 30) + "..."
                    : firstTopic}
              </Text>
              <Text style={{ fontSize: 10 }}>
                {BOOKLABEL_BARCODE_PLACEHOLDER == "barcode"
                  ? SCHOOL_NAME
                  : b.id}
              </Text>
            </View>
          </View>
        </div>
      );
    })
  );
  //console.log("All barcodes", allcodes);
  return allcodes;
};

async function createLabelsPDF(books: Array<BookType>) {
  var pdfstream;
  const barcodes = await generateBarcode(books);
  //console.log("barcodes", barcodes);
  const barcodesSections = chunkArray(barcodes, 10);

  pdfstream = ReactPDF.renderToStream(
    <Document>
      {barcodesSections.map((chunk, i) => (
        <Page
          wrap
          key={i}
          size="A4"
          style={{
            flexDirection: "column",
            backgroundColor: "#FFFFFF",
          }}
        >
          <View key={i} style={styles.pageContainer}>
            {chunk}
          </View>
        </Page>
      ))}
    </Document>
  );

  return pdfstream;
}

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse
) {
  switch (req.method) {
    case "GET":
      console.log("Printing book labels via api");
      try {
        const allbooks = (await getAllBooks(prisma)) as Array<BookType>;

        const topicFilter =
          "topic" in req.query
            ? (req.query.topic! as string).toLocaleLowerCase()
            : null;
        const idFilter =
          "id" in req.query ? parseInt(req.query.id! as string) : null;
        console.log("Filter string", topicFilter, idFilter);
        //TODO this should be able to do more than one topic!
        const books = allbooks
          .filter((b: BookType) => {
            return topicFilter
              ? b.topics!.toLocaleLowerCase().indexOf(topicFilter) > -1
              : true;
          })
          .filter((b: BookType) => {
            return idFilter ? b.id == idFilter : true;
          });
        //console.log("Filtered books", books);
        //console.log("Search Params", req.query, "end" in req.query);
        const startBookID = "start" in req.query ? req.query.start : "0";
        const endBookID = "end" in req.query ? req.query.end : books.length - 1;
        const printableBooks = books.slice(
          parseInt(startBookID as string),
          parseInt(endBookID as string)
        );

        console.log("Printing labels for books", startBookID, endBookID);

        if (!books)
          return res.status(400).json({ data: "ERROR: Books  not found" });

        //create a nice label PDF from the books
        //console.log(books);

        const labels = await createLabelsPDF(printableBooks);
        res.writeHead(200, {
          "Content-Type": "application/pdf",
        });
        labels.pipe(res);

        //res.status(200).json(labels);
      } catch (error) {
        console.log(error);
        res.status(400).json({ data: "ERROR: " + error });
      }
      break;

    default:
      res.status(405).end(`${req.method} Not Allowed`);
      break;
  }
}
