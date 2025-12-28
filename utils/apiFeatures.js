class APIFeatures {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
  }

  filter() {
    const queryObj = { ...this.queryString };
    const excludedFields = ["page", "sort", "limit", "fields"];
    excludedFields.forEach((el) => delete queryObj[el]);
    
    let keywordFilter = null;
    
    Object.keys(queryObj).forEach(function (key) {
      if (key != "price" && key != "promotion" && key != "promotion_gte" && key != "promotion_lte") {
        if (key != "keyword") {
          // Xử lý array filter (brand, category có thể là nhiều giá trị phân cách bởi dấu phẩy)
          const value = queryObj[key];
          if (typeof value === "string" && value.includes(",")) {
            queryObj[key] = { $in: value.split(",") };
          } else {
            // Giá trị đơn, giữ nguyên
            queryObj[key] = value;
          }
        }
        if ((key == "keyword")) {
          // Sử dụng regex để tìm kiếm partial match, không phân biệt hoa thường
          // Escape special regex characters
          const escapedKeyword = queryObj[key].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          keywordFilter = { 
            title: { $regex: escapedKeyword, $options: 'i' } 
          };
          delete queryObj[key];
        }
      }
      // Bỏ qua promotion_gte và promotion_lte nếu là giá trị mặc định
      if (key === "promotion_gte" && (queryObj[key] === "0" || queryObj[key] === 0)) {
        delete queryObj[key];
      }
      if (key === "promotion_lte" && (queryObj[key] === "100000000000" || queryObj[key] === 100000000000)) {
        delete queryObj[key];
      }
    });
    
    // Xử lý filter giá: filter theo promotion nếu có, không thì theo price
    let priceFilter = null;
    if (queryObj.promotion_gte !== undefined || queryObj.promotion_lte !== undefined) {
      const gte = queryObj.promotion_gte ? Number(queryObj.promotion_gte) : 0;
      const lte = queryObj.promotion_lte ? Number(queryObj.promotion_lte) : Number.MAX_SAFE_INTEGER;
      
      // Filter theo giá thực tế: promotion nếu có và > 0, không thì price
      priceFilter = {
        $or: [
          // Có promotion > 0 và promotion nằm trong khoảng
          { 
            $and: [
              { promotion: { $exists: true, $ne: null, $gt: 0 } },
              { promotion: { $gte: gte, $lte: lte } }
            ]
          },
          // Không có promotion hoặc promotion = 0/null, dùng price và price nằm trong khoảng
          { 
            $and: [
              {
                $or: [
                  { promotion: { $exists: false } },
                  { promotion: null },
                  { promotion: 0 }
                ]
              },
              { price: { $gte: gte, $lte: lte } }
            ]
          }
        ]
      };
      
      delete queryObj.promotion_gte;
      delete queryObj.promotion_lte;
    }
    
    // Advanced filtering
    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);

    let finalQuery = JSON.parse(queryStr);
    
    // Merge keyword filter và price filter với các filter khác
    if (keywordFilter) {
      finalQuery = { ...finalQuery, ...keywordFilter };
    }
    if (priceFilter) {
      // Merge priceFilter với $and để tránh conflict với các filter khác
      if (Object.keys(finalQuery).length > 0) {
        finalQuery = {
          $and: [
            finalQuery,
            priceFilter
          ]
        };
      } else {
        finalQuery = priceFilter;
      }
    }

    this.query = this.query.find(finalQuery);
    return this;
  }

  sort() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(",").join(" ");
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort("-_id");
    }

    return this;
  }

  limitFields() {
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(",").join(" ");
      this.query = this.query.select(fields);
    } else {
      this.query = this.query.select("-__v");
    }
    return this;
  }

  paginate() {
    const page = this.queryString.page * 1 || 1;
    const limit = this.queryString.limit * 1 || 100;
    const skip = (page - 1) * limit;

    this.query = this.query.skip(skip).limit(limit);
    return this;
  }
}
module.exports = APIFeatures;
