
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Download,
  Crown,
  Star,
  TrendingUp,
  FileText,
  Mail,
  Phone,
  MapPin,
  ChevronLeft,
  Award,
  AlertTriangle,
  CheckCircle,
  Filter,
  ArrowUpDown,
  Users,
  GitCompare,
  UserCheck,
  X,
  RotateCcw
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { simpleGeminiAnalyzer } from "@/services/simpleGeminiService";

const ResultsDashboard = ({ results, jobDescription, onBack }) => {
  const [selectedCandidate, setSelectedCandidate] = useState(0);
  const [viewMode, setViewMode] = useState('list'); // 'list', 'comparison'
  const [comparisonCandidates, setComparisonCandidates] = useState([]);
  const [sortBy, setSortBy] = useState('overallScore');
  const [sortOrder, setSortOrder] = useState('desc');
  const [filterBy, setFilterBy] = useState('all');
  const [minScore, setMinScore] = useState(0);
  const [maxScore, setMaxScore] = useState(100);
  const [teamFitAnalysis, setTeamFitAnalysis] = useState(null);
  const [teamFitLoading, setTeamFitLoading] = useState(false);
  const [teamDetails, setTeamDetails] = useState({
    teamSize: 5,
    teamSkills: '',
    workStyle: 'Collaborative',
    currentProjects: '',
    teamCulture: 'Innovation-focused',
    leadershipStyle: 'Democratic'
  });

  // Handle both old and new result formats
  const isNewFormat = results.individualAnalyses && results.comparativeRanking;
  const allCandidates = isNewFormat
    ? results.individualAnalyses
    : results.topCandidates || [];

  const summary = isNewFormat ? results.summary : results.summary;

  // Filter and sort candidates
  const getFilteredAndSortedCandidates = () => {
    let filtered = allCandidates.filter(candidate => {
      // Ensure candidate has a valid score
      const score = candidate.overallScore || 0;

      // Score range filter - ensure both minScore and maxScore are valid numbers
      const minScoreValue = Math.max(0, Math.min(100, minScore || 0));
      const maxScoreValue = Math.max(0, Math.min(100, maxScore || 100));

      if (score < minScoreValue || score > maxScoreValue) {
        return false;
      }

      // Category filter - fix the logic to properly handle all cases
      switch (filterBy) {
        case 'all':
          return true;
        case 'recommended':
          return score >= 75;
        case 'high-potential':
          return score >= 65 && score < 85;
        case 'needs-review':
          return score < 65;
        default:
          return true;
      }
    });

    // Sort candidates with improved handling
    filtered.sort((a, b) => {
      let aValue, bValue;

      // Handle different sort properties with better fallbacks
      switch (sortBy) {
        case 'fileName':
          aValue = (a.fileName || a.name || 'Unknown').toLowerCase();
          bValue = (b.fileName || b.name || 'Unknown').toLowerCase();
          break;
        case 'overallScore':
          aValue = Number(a.overallScore) || 0;
          bValue = Number(b.overallScore) || 0;
          break;
        case 'skillsMatch':
          aValue = Number(a.skillsMatch || a.skillsMatchScore) || 0;
          bValue = Number(b.skillsMatch || b.skillsMatchScore) || 0;
          break;
        case 'experienceMatch':
          aValue = Number(a.experienceMatch || a.experienceScore) || 0;
          bValue = Number(b.experienceMatch || b.experienceScore) || 0;
          break;
        case 'technicalFit':
          aValue = Number(a.technicalFit || a.technicalScore || a.communicationScore) || 0;
          bValue = Number(b.technicalFit || b.technicalScore || b.communicationScore) || 0;
          break;
        case 'educationMatch':
          aValue = Number(a.educationMatch) || 0;
          bValue = Number(b.educationMatch) || 0;
          break;
        default:
          // Fallback for any other property
          aValue = a[sortBy] || 0;
          bValue = b[sortBy] || 0;
      }

      // Handle string vs number comparison with better type checking
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      } else {
        // Ensure numeric comparison
        const numA = Number(aValue) || 0;
        const numB = Number(bValue) || 0;
        return sortOrder === 'asc'
          ? numA - numB
          : numB - numA;
      }
    });

    return filtered;
  };

  const candidates = getFilteredAndSortedCandidates();

  // Debug logging
  console.log('🔍 Filter/Sort Debug:', {
    sortBy,
    sortOrder,
    filterBy,
    minScore,
    maxScore,
    totalCandidates: allCandidates.length,
    filteredCandidates: candidates.length,
    candidateScores: candidates.map(c => ({ name: c.fileName, score: c.overallScore }))
  });

  // Download individual resume PDF
  const downloadResume = (candidate) => {
    if (candidate.originalFile) {
      const url = URL.createObjectURL(candidate.originalFile);
      const a = document.createElement('a');
      a.href = url;
      a.download = candidate.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Resume Downloaded",
        description: `${candidate.fileName} has been downloaded successfully.`,
      });
    } else {
      toast({
        title: "Download Failed",
        description: "Original resume file not available.",
        variant: "destructive"
      });
    }
  };

  // Toggle candidate for comparison
  const toggleComparison = (candidate) => {
    if (comparisonCandidates.find(c => c.fileName === candidate.fileName)) {
      setComparisonCandidates(comparisonCandidates.filter(c => c.fileName !== candidate.fileName));
    } else if (comparisonCandidates.length < 3) {
      setComparisonCandidates([...comparisonCandidates, candidate]);
    } else {
      toast({
        title: "Comparison Limit",
        description: "You can compare up to 3 candidates at once.",
        variant: "destructive"
      });
    }
  };

  // Analyze team fit
  const analyzeTeamFit = async (candidate) => {
    setTeamFitLoading(true);
    try {
      const teamDetailsFormatted = {
        teamSize: parseInt(teamDetails.teamSize),
        teamSkills: teamDetails.teamSkills.split(',').map(s => s.trim()).filter(s => s),
        workStyle: teamDetails.workStyle,
        currentProjects: teamDetails.currentProjects.split(',').map(s => s.trim()).filter(s => s),
        teamCulture: teamDetails.teamCulture,
        leadershipStyle: teamDetails.leadershipStyle
      };

      // Find candidate's rank in the sorted list
      const candidateRank = candidates.findIndex(c => c.fileName === candidate.fileName) + 1;
      const isTopCandidate = candidateRank <= 2; // Only first 2 candidates get good team fit

      // Create enhanced candidate profile with ranking info
      const enhancedCandidateProfile = {
        ...candidate.candidateProfile || {
          personalInfo: { name: candidate.fileName.replace('.pdf', '') },
          totalExperienceYears: 2,
          technicalSkills: { languages: [], frameworks: [], tools: [] },
          experience: [],
          projects: []
        },
        // Add ranking information for better team fit analysis
        candidateRank,
        isTopCandidate,
        overallScore: candidate.overallScore
      };

      const analysis = await simpleGeminiAnalyzer.analyzeTeamFitWithRank(
        enhancedCandidateProfile,
        teamDetailsFormatted,
        candidateRank,
        isTopCandidate
      );

      setTeamFitAnalysis({ candidate, analysis });

      toast({
        title: "Team Fit Analysis Complete",
        description: `Analysis completed for ${candidate.fileName} (Rank #${candidateRank})`,
      });
    } catch (error) {
      console.error('Team fit analysis failed:', error);
      toast({
        title: "Analysis Failed",
        description: "Unable to complete team fit analysis. Please try again.",
        variant: "destructive"
      });
    } finally {
      setTeamFitLoading(false);
    }
  };

  const downloadReport = () => {
    const reportData = {
      jobDescription,
      results,
      generatedAt: new Date().toISOString(),
      summary: summary,
      analysisType: isNewFormat ? 'Comparative Batch Analysis' : 'Individual Analysis',
      comparativeRanking: isNewFormat ? results.comparativeRanking : null
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-resume-analysis-${jobDescription.jobTitle.replace(/\s+/g, '-').toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Report Downloaded",
      description: "Analysis report has been downloaded successfully.",
    });
  };

  const getScoreColor = (score) => {
    if (score >= 90) return "text-green-600";
    if (score >= 80) return "text-blue-600";
    if (score >= 70) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreBg = (score) => {
    if (score >= 90) return "bg-green-50 border-green-200";
    if (score >= 80) return "bg-blue-50 border-blue-200";
    if (score >= 70) return "bg-yellow-50 border-yellow-200";
    return "bg-red-50 border-red-200";
  };

  const candidate = candidates[selectedCandidate];
  const totalAnalyzed = isNewFormat ? summary.totalCandidates : summary.totalAnalyzed;
  const averageScore = isNewFormat ? summary.averageScore : summary.averageScore;
  const topScore = isNewFormat ? summary.topScore : summary.topCandidateScore;
  const recommendedCount = isNewFormat ? summary.recommendedCount : 3;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold flex items-center gap-3">
                <Crown className="w-8 h-8" />
                {isNewFormat ? 'Comparative Analysis Results' : `Top 3 Candidates`} for {jobDescription.jobTitle}
              </CardTitle>
              <p className="text-blue-100 mt-2">
                {isNewFormat ? 'AI-powered comparative ranking' : 'AI-powered analysis'} of {totalAnalyzed} candidates completed in {summary.processingTime}ms
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setViewMode(viewMode === 'list' ? 'comparison' : 'list')}
                variant="secondary"
                className="gap-2"
                disabled={viewMode === 'comparison' && comparisonCandidates.length < 2}
              >
                <GitCompare className="w-4 h-4" />
                {viewMode === 'list' ? 'Compare' : 'List View'}
              </Button>
              <Button
                onClick={downloadReport}
                variant="secondary"
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Download Report
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Filters and Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters & Sorting
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="sort-by">Sort By</Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="overallScore">Overall Score</SelectItem>
                  <SelectItem value="skillsMatch">Skills Match</SelectItem>
                  <SelectItem value="experienceMatch">Experience Match</SelectItem>
                  <SelectItem value="educationMatch">Education Match</SelectItem>
                  <SelectItem value="technicalFit">Technical Fit</SelectItem>
                  <SelectItem value="fileName">Name</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="sort-order">Order</Label>
              <Select value={sortOrder} onValueChange={setSortOrder}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">High to Low</SelectItem>
                  <SelectItem value="asc">Low to High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="filter-by">Filter By</Label>
              <Select value={filterBy} onValueChange={setFilterBy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Candidates</SelectItem>
                  <SelectItem value="recommended">Recommended (75%+)</SelectItem>
                  <SelectItem value="high-potential">High Potential (65-84%)</SelectItem>
                  <SelectItem value="needs-review">Needs Review (&lt;65%)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Score Range</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={minScore}
                  onChange={(e) => setMinScore(Number(e.target.value))}
                  min="0"
                  max="100"
                  className="w-20"
                />
                <Input
                  type="number"
                  placeholder="Max"
                  value={maxScore}
                  onChange={(e) => setMaxScore(Number(e.target.value))}
                  min="0"
                  max="100"
                  className="w-20"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center mt-4">
            <p className="text-sm text-muted-foreground">
              Showing {candidates.length} of {allCandidates.length} candidates
              {comparisonCandidates.length > 0 && (
                <span className="ml-2">• {comparisonCandidates.length} selected for comparison</span>
              )}
            </p>
            <div className="flex gap-2">
              {comparisonCandidates.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setComparisonCandidates([])}
                  className="gap-1"
                >
                  <X className="w-3 h-3" />
                  Clear Selection
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSortBy('overallScore');
                  setSortOrder('desc');
                  setFilterBy('all');
                  setMinScore(0);
                  setMaxScore(100);
                }}
                className="gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Reset Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Ranking Display */}
      {candidates.length > 0 && (
        <Card className="bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                  <Crown className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-yellow-800">🏆 Top Ranked Candidate</h3>
                  <p className="text-yellow-700 font-semibold">{candidates[0]?.fileName || candidates[0]?.name}</p>
                  <p className="text-sm text-yellow-600">Overall Score: {candidates[0]?.overallScore}%</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-yellow-800">#1</div>
                <div className="text-sm text-yellow-600">Best Match</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Analyzed</p>
                <p className="text-2xl font-bold">{totalAnalyzed}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Average Score</p>
                <p className="text-2xl font-bold">{averageScore}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Star className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Top Score</p>
                <p className="text-2xl font-bold">{topScore}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Award className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Recommended</p>
                <p className="text-2xl font-bold">{recommendedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {viewMode === 'list' ? (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Candidate Selection */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{isNewFormat ? 'Ranked Candidates' : 'Top Candidates'}</h3>
            {candidates.map((candidate, index) => (
              <Card
                key={candidate.fileName}
                className={`transition-all duration-200 ${
                  selectedCandidate === index
                    ? 'ring-2 ring-blue-500 bg-blue-50'
                    : 'hover:shadow-md'
                } ${comparisonCandidates.find(c => c.fileName === candidate.fileName) ? 'ring-2 ring-green-500' : ''}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-center gap-2">
                        <div className={`
                          w-8 h-8 rounded-full flex items-center justify-center text-white font-bold relative
                          ${index === 0 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600 shadow-lg' :
                            index === 1 ? 'bg-gradient-to-r from-gray-400 to-gray-600' :
                            index === 2 ? 'bg-gradient-to-r from-amber-500 to-amber-700' :
                            'bg-gradient-to-r from-blue-500 to-blue-700'}
                        `}>
                          {index + 1}
                          {index === 0 && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border border-white">
                              <Crown className="w-2 h-2 text-yellow-800 absolute top-0.5 left-0.5" />
                            </div>
                          )}
                        </div>
                        <input
                          type="checkbox"
                          checked={comparisonCandidates.find(c => c.fileName === candidate.fileName) !== undefined}
                          onChange={() => toggleComparison(candidate)}
                          className="w-4 h-4"
                          title="Select for comparison"
                        />
                      </div>
                      <div
                        className="flex-1 cursor-pointer"
                        onClick={() => setSelectedCandidate(index)}
                      >
                        <h4 className="font-semibold flex items-center gap-2">
                          {candidate.fileName || candidate.name}
                          {index === 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                              <Crown className="w-3 h-3" />
                              #1 RANKED
                            </span>
                          )}
                          {index === 1 && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded-full">
                              #2 RANKED
                            </span>
                          )}
                          {index === 2 && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded-full">
                              #3 RANKED
                            </span>
                          )}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {candidate.recommendation || (candidate.overallScore >= 85 ? 'Highly Recommended' :
                           candidate.overallScore >= 75 ? 'Recommended' :
                           candidate.overallScore >= 65 ? 'Consider' : 'Not Recommended')}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="text-right">
                        <div className={`text-2xl font-bold ${getScoreColor(candidate.overallScore)}`}>
                          {candidate.overallScore}%
                        </div>
                        <div className="text-xs text-muted-foreground">Overall Score</div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadResume(candidate)}
                        className="gap-1"
                        title="Download Resume"
                      >
                        <Download className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Detailed Analysis */}
          <div className="lg:col-span-2 space-y-6">
            <Card className={`${getScoreBg(candidate.overallScore)} border-2`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl">{candidate.fileName || candidate.name}</CardTitle>
                    <p className="text-muted-foreground mt-1">
                      Candidate #{selectedCandidate + 1} • {candidate.recommendation || (candidate.overallScore >= 85 ? 'Highly Recommended' :
                       candidate.overallScore >= 75 ? 'Recommended' :
                       candidate.overallScore >= 65 ? 'Consider' : 'Not Recommended')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                          <UserCheck className="w-4 h-4" />
                          Team Fit Analysis
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Team Fit Analysis for {candidate.fileName}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="grid md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="team-size">Team Size</Label>
                              <Input
                                id="team-size"
                                type="number"
                                value={teamDetails.teamSize}
                                onChange={(e) => setTeamDetails({...teamDetails, teamSize: e.target.value})}
                              />
                            </div>
                            <div>
                              <Label htmlFor="work-style">Work Style</Label>
                              <Select value={teamDetails.workStyle} onValueChange={(value) => setTeamDetails({...teamDetails, workStyle: value})}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Collaborative">Collaborative</SelectItem>
                                  <SelectItem value="Independent">Independent</SelectItem>
                                  <SelectItem value="Hybrid">Hybrid</SelectItem>
                                  <SelectItem value="Agile">Agile</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div>
                            <Label htmlFor="team-skills">Current Team Skills (comma-separated)</Label>
                            <Textarea
                              id="team-skills"
                              placeholder="React, Node.js, Python, AWS, etc."
                              value={teamDetails.teamSkills}
                              onChange={(e) => setTeamDetails({...teamDetails, teamSkills: e.target.value})}
                            />
                          </div>

                          <div>
                            <Label htmlFor="current-projects">Current Projects (comma-separated)</Label>
                            <Textarea
                              id="current-projects"
                              placeholder="E-commerce platform, Mobile app, API development, etc."
                              value={teamDetails.currentProjects}
                              onChange={(e) => setTeamDetails({...teamDetails, currentProjects: e.target.value})}
                            />
                          </div>

                          <div className="grid md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="team-culture">Team Culture</Label>
                              <Select value={teamDetails.teamCulture} onValueChange={(value) => setTeamDetails({...teamDetails, teamCulture: value})}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Innovation-focused">Innovation-focused</SelectItem>
                                  <SelectItem value="Results-driven">Results-driven</SelectItem>
                                  <SelectItem value="Learning-oriented">Learning-oriented</SelectItem>
                                  <SelectItem value="Customer-centric">Customer-centric</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label htmlFor="leadership-style">Leadership Style</Label>
                              <Select value={teamDetails.leadershipStyle} onValueChange={(value) => setTeamDetails({...teamDetails, leadershipStyle: value})}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Democratic">Democratic</SelectItem>
                                  <SelectItem value="Coaching">Coaching</SelectItem>
                                  <SelectItem value="Visionary">Visionary</SelectItem>
                                  <SelectItem value="Servant">Servant Leadership</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <Button
                            onClick={() => analyzeTeamFit(candidate)}
                            disabled={teamFitLoading}
                            className="w-full"
                          >
                            {teamFitLoading ? 'Analyzing...' : 'Analyze Team Fit'}
                          </Button>

                          {teamFitAnalysis && teamFitAnalysis.candidate.fileName === candidate.fileName && (
                            <div className="mt-4 space-y-4 border-t pt-4">
                              <h4 className="font-semibold flex items-center gap-2">
                                Team Fit Analysis Results
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                                  {candidates.findIndex(c => c.fileName === candidate.fileName) === 0 ? (
                                    <>
                                      <Crown className="w-3 h-3" />
                                      TOP RANKED CANDIDATE
                                    </>
                                  ) : (
                                    `RANKED #${candidates.findIndex(c => c.fileName === candidate.fileName) + 1}`
                                  )}
                                </span>
                              </h4>
                              <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                  <div className="flex justify-between text-sm mb-1">
                                    <span>Overall Team Fit</span>
                                    <span className={getScoreColor(teamFitAnalysis.analysis.teamFitScore)}>
                                      {teamFitAnalysis.analysis.teamFitScore}%
                                    </span>
                                  </div>
                                  <Progress value={teamFitAnalysis.analysis.teamFitScore} className="h-2" />
                                </div>
                                <div>
                                  <div className="flex justify-between text-sm mb-1">
                                    <span>Cultural Alignment</span>
                                    <span className={getScoreColor(teamFitAnalysis.analysis.culturalAlignment)}>
                                      {teamFitAnalysis.analysis.culturalAlignment}%
                                    </span>
                                  </div>
                                  <Progress value={teamFitAnalysis.analysis.culturalAlignment} className="h-2" />
                                </div>
                                <div>
                                  <div className="flex justify-between text-sm mb-1">
                                    <span>Skill Complementarity</span>
                                    <span className={getScoreColor(teamFitAnalysis.analysis.skillComplementarity)}>
                                      {teamFitAnalysis.analysis.skillComplementarity}%
                                    </span>
                                  </div>
                                  <Progress value={teamFitAnalysis.analysis.skillComplementarity} className="h-2" />
                                </div>
                                <div>
                                  <div className="flex justify-between text-sm mb-1">
                                    <span>Collaboration Potential</span>
                                    <span className={getScoreColor(teamFitAnalysis.analysis.collaborationPotential)}>
                                      {teamFitAnalysis.analysis.collaborationPotential}%
                                    </span>
                                  </div>
                                  <Progress value={teamFitAnalysis.analysis.collaborationPotential} className="h-2" />
                                </div>
                              </div>

                              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <h5 className="font-semibold text-blue-800 mb-2">AI Insights</h5>
                                <p className="text-blue-700 text-sm">{teamFitAnalysis.analysis.insights}</p>
                              </div>

                              <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                  <h5 className="font-semibold mb-2 flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                    Team Fit Strengths
                                  </h5>
                                  <div className="space-y-1">
                                    {teamFitAnalysis.analysis.strengths.map((strength, index) => (
                                      <div key={index} className="flex items-center gap-2 text-sm">
                                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                        {strength}
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div>
                                  <h5 className="font-semibold mb-2 flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-yellow-600" />
                                    Areas of Concern
                                  </h5>
                                  <div className="space-y-1">
                                    {teamFitAnalysis.analysis.concerns.map((concern, index) => (
                                      <div key={index} className="flex items-center gap-2 text-sm text-yellow-700">
                                        <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                                        {concern}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              <div>
                                <h5 className="font-semibold mb-2">Recommendations</h5>
                                <div className="space-y-1">
                                  {teamFitAnalysis.analysis.recommendations.map((rec, index) => (
                                    <div key={index} className="flex items-center gap-2 text-sm">
                                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                      {rec}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                    <Badge
                      variant={candidate.overallScore >= 90 ? "default" : "secondary"}
                      className="text-lg px-3 py-1"
                    >
                      {candidate.overallScore}% Match
                    </Badge>
                  </div>
                </div>
              </CardHeader>
            <CardContent className="space-y-6">
              {/* Score Breakdown */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Skills Match</span>
                      <span className={getScoreColor(candidate.skillsMatch)}>
                        {candidate.skillsMatch}%
                      </span>
                    </div>
                    <Progress value={candidate.skillsMatch} className="h-2" />
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Experience Match</span>
                      <span className={getScoreColor(candidate.experienceMatch)}>
                        {candidate.experienceMatch}%
                      </span>
                    </div>
                    <Progress value={candidate.experienceMatch} className="h-2" />
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Technical Fit</span>
                      <span className={getScoreColor(candidate.technicalFit || candidate.communicationScore || 75)}>
                        {candidate.technicalFit || candidate.communicationScore || 75}%
                      </span>
                    </div>
                    <Progress value={candidate.technicalFit || candidate.communicationScore || 75} className="h-2" />
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Education Match</span>
                      <span className={getScoreColor(candidate.educationMatch)}>
                        {candidate.educationMatch}%
                      </span>
                    </div>
                    <Progress value={candidate.educationMatch} className="h-2" />
                  </div>
                </div>
              </div>

              {/* AI Insights */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                  <Star className="w-4 h-4" />
                  AI Insights
                </h4>
                <p className="text-blue-700 text-sm">{candidate.aiInsights}</p>
              </div>

              {/* Strengths */}
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  Key Strengths
                </h4>
                <div className="grid md:grid-cols-2 gap-2">
                  {candidate.strengths.map((strength, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      {strength}
                    </div>
                  ))}
                </div>
              </div>

              {/* Concerns */}
              {(candidate.concerns || candidate.weaknesses)?.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-600" />
                    Areas for Clarification
                  </h4>
                  <div className="space-y-1">
                    {(candidate.concerns || candidate.weaknesses || []).map((concern, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm text-yellow-700">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                        {concern}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Show comparative ranking info if available */}
              {isNewFormat && results.comparativeRanking && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h4 className="font-semibold text-purple-800 mb-2 flex items-center gap-2">
                    <Crown className="w-4 h-4" />
                    Comparative Ranking
                  </h4>
                  <p className="text-purple-700 text-sm">
                    {results.comparativeRanking.summary}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      ) : (
        // Comparison View
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Candidate Comparison</h3>
            <p className="text-sm text-muted-foreground">
              Comparing {comparisonCandidates.length} candidates side by side
            </p>
          </div>

          {comparisonCandidates.length < 2 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h4 className="text-lg font-semibold text-gray-600 mb-2">Select Candidates to Compare</h4>
                <p className="text-gray-500 mb-4">
                  Please select at least 2 candidates from the list view to enable side-by-side comparison.
                </p>
                <Button onClick={() => setViewMode('list')} variant="outline">
                  Back to List View
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${Math.min(comparisonCandidates.length, 3)}, 1fr)` }}>
              {comparisonCandidates.slice(0, 3).map((candidate, index) => (
                <Card key={candidate.fileName} className={`${getScoreBg(candidate.overallScore)} border-2`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          {candidate.fileName}
                          {candidates.findIndex(c => c.fileName === candidate.fileName) === 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                              <Crown className="w-3 h-3" />
                              #1
                            </span>
                          )}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          Rank #{candidates.findIndex(c => c.fileName === candidate.fileName) + 1} • {candidate.recommendation || (candidate.overallScore >= 85 ? 'Highly Recommended' :
                           candidate.overallScore >= 75 ? 'Recommended' :
                           candidate.overallScore >= 65 ? 'Consider' : 'Not Recommended')}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge
                          variant={candidate.overallScore >= 90 ? "default" : "secondary"}
                          className="text-lg px-3 py-1"
                        >
                          {candidate.overallScore}%
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadResume(candidate)}
                          className="gap-1"
                        >
                          <Download className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Score Breakdown */}
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Skills Match</span>
                          <span className={getScoreColor(candidate.skillsMatch)}>
                            {candidate.skillsMatch}%
                          </span>
                        </div>
                        <Progress value={candidate.skillsMatch} className="h-2" />
                      </div>

                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Experience Match</span>
                          <span className={getScoreColor(candidate.experienceMatch)}>
                            {candidate.experienceMatch}%
                          </span>
                        </div>
                        <Progress value={candidate.experienceMatch} className="h-2" />
                      </div>

                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Technical Fit</span>
                          <span className={getScoreColor(candidate.technicalFit || candidate.communicationScore || 75)}>
                            {candidate.technicalFit || candidate.communicationScore || 75}%
                          </span>
                        </div>
                        <Progress value={candidate.technicalFit || candidate.communicationScore || 75} className="h-2" />
                      </div>

                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Education Match</span>
                          <span className={getScoreColor(candidate.educationMatch)}>
                            {candidate.educationMatch}%
                          </span>
                        </div>
                        <Progress value={candidate.educationMatch} className="h-2" />
                      </div>
                    </div>

                    {/* Key Strengths */}
                    <div>
                      <h5 className="font-semibold mb-2 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        Key Strengths
                      </h5>
                      <div className="space-y-1">
                        {candidate.strengths.slice(0, 3).map((strength, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-sm">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            {strength}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Areas for Improvement */}
                    {(candidate.concerns || candidate.weaknesses)?.length > 0 && (
                      <div>
                        <h5 className="font-semibold mb-2 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-yellow-600" />
                          Areas for Review
                        </h5>
                        <div className="space-y-1">
                          {(candidate.concerns || candidate.weaknesses || []).slice(0, 2).map((concern, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm text-yellow-700">
                              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                              {concern}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* AI Insights */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <h5 className="font-semibold text-blue-800 mb-1 text-sm">AI Insights</h5>
                      <p className="text-blue-700 text-xs">{candidate.aiInsights}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4 pt-4 border-t">
        <Button 
          variant="outline" 
          onClick={onBack}
          className="gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Processing
        </Button>
        <Button 
          onClick={downloadReport}
          className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
        >
          <Download className="w-4 h-4" />
          Download Full Report
        </Button>
      </div>
    </div>
  );
};

export default ResultsDashboard;
