const Book = require('../models/Book');
const Follow = require('../models/Follow');
const View = require('../models/View');
const Save = require('../models/Save');

const calculatePerformance = async (lecturerId) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));
    const sevenDaysAgo = new Date(now.setDate(now.getDate() - 7));

    // Get lecturer's books
    const books = await Book.find({ lecturerId });
    const bookIds = books.map(b => b._id);

    // Calculate Save Rate
    let totalSaves = 0;
    let totalViews = 0;
    
    for (const book of books) {
      const saves = await Save.countDocuments({ bookId: book._id });
      const views = await View.countDocuments({ bookId: book._id });
      totalSaves += saves;
      totalViews += views;
    }
    
    const saveRate = totalViews > 0 ? (totalSaves / totalViews) * 100 : 0;

    // Calculate Follower Growth
    const totalFollowers = await Follow.countDocuments({ lecturerId });
    const newFollowers = await Follow.countDocuments({
      lecturerId,
      createdAt: { $gte: thirtyDaysAgo }
    });
    const followerGrowth = totalFollowers > 0 ? (newFollowers / totalFollowers) * 100 : 0;

    // Calculate View Engagement (last 7 days vs previous 7 days)
    const lastWeekViews = await View.countDocuments({
      bookId: { $in: bookIds },
      createdAt: { $gte: sevenDaysAgo }
    });
    
    const previousWeekStart = new Date(sevenDaysAgo);
    previousWeekStart.setDate(previousWeekStart.getDate() - 7);
    const previousWeekViews = await View.countDocuments({
      bookId: { $in: bookIds },
      createdAt: { $gte: previousWeekStart, $lt: sevenDaysAgo }
    });
    
    const viewEngagement = previousWeekViews > 0 
      ? ((lastWeekViews - previousWeekViews) / previousWeekViews) * 100 
      : lastWeekViews > 0 ? 100 : 0;

    // Calculate Consistency Score (publications in last 30 days)
    const recentPublications = await Book.countDocuments({
      lecturerId,
      createdAt: { $gte: thirtyDaysAgo }
    });
    const consistencyScore = Math.min(recentPublications / 3, 1.0); // Max 3 books per month

    // Final Performance Percentage
    let performance = (
      (saveRate * 0.4) +
      (followerGrowth * 0.3) +
      (viewEngagement * 0.2) +
      (consistencyScore * 0.1)
    );
    
    // Cap at 100%
    performance = Math.min(Math.max(performance, 0), 100);
    
    // Generate chart data for last 6 months
    const chartData = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date();
      monthDate.setMonth(monthDate.getMonth() - i);
      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
      
      const monthSaves = await Save.countDocuments({
        bookId: { $in: bookIds },
        createdAt: { $gte: monthStart, $lte: monthEnd }
      });
      
      chartData.push({
        label: monthDate.toLocaleString('default', { month: 'short' }),
        value: monthSaves,
      });
    }

    return {
      percentage: Math.round(performance),
      chartData,
      metrics: {
        saveRate: Math.round(saveRate),
        followerGrowth: Math.round(followerGrowth),
        viewEngagement: Math.round(viewEngagement),
        consistencyScore: Math.round(consistencyScore * 100),
      },
    };
  } catch (error) {
    console.error('Performance calculation error:', error);
    return {
      percentage: 0,
      chartData: [],
      metrics: {
        saveRate: 0,
        followerGrowth: 0,
        viewEngagement: 0,
        consistencyScore: 0,
      },
    };
  }
};

module.exports = {
  calculatePerformance,
};